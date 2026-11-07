import { useEffect, useMemo, useRef, useState } from "react";
import Encabezado from "../components/Encabezado";
import {
  clasificar,
  contar,
  MIN_RESPUESTAS,
  type Opcion,
  type Nivel,
} from "../lib/clasificacion";
import {
  listarExamenes,
  listarPreguntasDeExamen,
  listarGrupos,
  crearGrupo,
  existeIntento,
  registrarRespuestas,
  listarIntentosDeExamen,
  cargarIntento,
  type ExamenResumen,
  type Grupo,
  type PreguntaExamen,
  type IntentoCargado,
} from "../lib/captura";

const CODIGO_REGEX = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const TAM_PAGINA = 25;
const ETIQUETA: Record<Nivel, string> = {
  literal: "Literal",
  inferencial: "Inferencial",
  critico: "Crítico",
};

export default function Captura() {
  const [examenes, setExamenes] = useState<ExamenResumen[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [examenId, setExamenId] = useState<number | null>(null);
  const [grupoId, setGrupoId] = useState<number | null>(null);
  const [preguntas, setPreguntas] = useState<PreguntaExamen[]>([]);
  const [intentos, setIntentos] = useState<IntentoCargado[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);

  const [codigo, setCodigo] = useState("");
  const [resp, setResp] = useState<(Opcion | null)[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [mensaje, setMensaje] = useState<{
    tipo: "ok" | "error";
    texto: string;
  } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);

  const codigoRef = useRef<HTMLInputElement>(null);
  const celdas = useRef<(HTMLInputElement | null)[]>([]);

  // Carga inicial: exámenes y grupos
  useEffect(() => {
    Promise.all([listarExamenes(), listarGrupos()])
      .then(([ex, gr]) => {
        setExamenes(ex);
        setGrupos(gr);
        const inicial = ex.find((e) => e.tipo === "pre" && e.activo) ?? ex[0];
        if (inicial) setExamenId(inicial.id);
      })
      .catch(() => setErrorCarga(true));
  }, []);

  // Al cambiar de examen: preguntas + todo lo que ya se ha cargado en él
  useEffect(() => {
    if (examenId === null) return;
    let vigente = true;

    setCargandoLista(true);
    setPreguntas([]);
    setIntentos([]);
    setResp([]);
    setCodigo("");
    setEditando(null);
    setBusqueda("");
    setPagina(0);
    setMensaje(null);

    Promise.all([
      listarPreguntasDeExamen(examenId),
      listarIntentosDeExamen(examenId),
    ])
      .then(([ps, ints]) => {
        if (!vigente) return;
        setPreguntas(ps);
        setResp(Array(ps.length).fill(null));
        setIntentos(ints);
      })
      .catch(() => {
        if (vigente) setErrorCarga(true);
      })
      .finally(() => {
        if (vigente) setCargandoLista(false);
      });

    return () => {
      vigente = false;
    };
  }, [examenId]);

  const vista = useMemo(() => clasificar(contar(resp)), [resp]);
  const contestadas = vista.total;

  // Lista de lo ya cargado: respuestas alineadas con las preguntas del examen
  const filasLista = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return intentos
      .filter((i) => !q || i.codigo.includes(q))
      .map((intento) => {
        const letras = preguntas.map(
          (p) => intento.respuestas[p.pregunta_id] ?? null,
        );
        return { intento, letras, ...clasificar(contar(letras)) };
      });
  }, [intentos, preguntas, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filasLista.length / TAM_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = filasLista.slice(
    paginaActual * TAM_PAGINA,
    (paginaActual + 1) * TAM_PAGINA,
  );

  function cambiarCelda(i: number, valor: string) {
    const v = valor.slice(-1).toUpperCase();
    const poner = (op: Opcion | null) =>
      setResp((r) => r.map((x, j) => (j === i ? op : x)));

    if (v === "A" || v === "B" || v === "C") {
      poner(v as Opcion);
      celdas.current[i + 1]?.focus();
    } else if (v === "-" || v === " ") {
      poner(null);
      celdas.current[i + 1]?.focus();
    } else if (v === "") {
      poner(null);
    }
  }

  function teclaCelda(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      guardar();
    } else if (e.key === "Backspace" && resp[i] === null && i > 0) {
      e.preventDefault();
      setResp((r) => r.map((x, j) => (j === i - 1 ? null : x)));
      celdas.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft") {
      celdas.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight") {
      celdas.current[i + 1]?.focus();
    }
  }

  async function nuevoGrupo() {
    const nombre = prompt("Nombre del nuevo grupo")?.trim();
    if (!nombre) return;
    try {
      const g = await crearGrupo(nombre);
      setGrupos((gs) =>
        [...gs, g].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      setGrupoId(g.id);
    } catch {
      alert("No se pudo crear el grupo (¿ya existe uno con ese nombre?).");
    }
  }

  function editar(intento: IntentoCargado, letras: (Opcion | null)[]) {
    setCodigo(intento.codigo);
    setResp(letras);
    setEditando(intento.codigo);
    setMensaje(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    celdas.current[0]?.focus();
  }

  function cancelarEdicion() {
    setCodigo("");
    setResp(Array(preguntas.length).fill(null));
    setEditando(null);
    codigoRef.current?.focus();
  }

  async function guardar() {
    if (guardando || examenId === null) return;

    const cod = codigo.trim().toUpperCase();
    if (!CODIGO_REGEX.test(cod)) {
      return setMensaje({
        tipo: "error",
        texto: "Código no válido: solo letras, números y guiones (ej. INC-1).",
      });
    }
    if (contestadas === 0) {
      return setMensaje({
        tipo: "error",
        texto: "No hay respuestas marcadas.",
      });
    }

    const esEdicion = editando === cod;

    setMensaje(null);
    setGuardando(true);
    try {
      if (
        !esEdicion &&
        (await existeIntento(cod, examenId)) &&
        !confirm(`${cod} ya tiene respuestas en este examen. ¿Reemplazarlas?`)
      )
        return;

      if (
        contestadas < MIN_RESPUESTAS &&
        !confirm(
          `Solo hay ${contestadas} respuestas (mínimo ${MIN_RESPUESTAS}). Se guardará, pero el estudiante quedará excluido del análisis. ¿Continuar?`,
        )
      )
        return;

      const payload: Record<number, Opcion> = {};
      preguntas.forEach((p, i) => {
        const r = resp[i];
        if (r) payload[p.pregunta_id] = r;
      });

      // Al editar se conserva el grupo que el estudiante ya tiene
      const fallo = await registrarRespuestas(
        cod,
        examenId,
        payload,
        esEdicion ? null : grupoId,
      );
      if (fallo) {
        return setMensaje({
          tipo: "error",
          texto:
            fallo === "codigo_invalido"
              ? "El código no tiene un formato válido."
              : "No se pudo guardar. Revisa la conexión e intenta de nuevo.",
        });
      }

      // Refrescar solo esta fila en la lista (sube al primer lugar)
      const nuevo = await cargarIntento(cod, examenId).catch(() => null);
      if (nuevo) {
        setIntentos((prev) => [nuevo, ...prev.filter((x) => x.codigo !== cod)]);
        setPagina(0);
      }

      setMensaje({
        tipo: "ok",
        texto: `${cod} ${esEdicion ? "actualizado" : "guardado"}.`,
      });
      setCodigo("");
      setResp(Array(preguntas.length).fill(null));
      setEditando(null);
      codigoRef.current?.focus();
    } catch {
      setMensaje({
        tipo: "error",
        texto: "No se pudo guardar. Revisa la conexión e intenta de nuevo.",
      });
    } finally {
      setGuardando(false);
    }
  }

  if (errorCarga)
    return <p>No se pudo cargar la información. Recarga la página.</p>;
  if (examenId === null) return <p>Cargando…</p>;

  return (
    <div className="captura">
      <Encabezado />
      <h1>Captura de respuestas</h1>

      <div className="controles">
        <label>
          Examen
          <select
            value={examenId}
            onChange={(e) => setExamenId(Number(e.target.value))}
          >
            {examenes.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.nombre} ({ex.tipo === "pre" ? "Pre" : "Post"})
                {ex.activo ? "" : " - inactivo"}
              </option>
            ))}
          </select>
        </label>

        <label>
          Grupo (opcional)
          <span className="fila">
            <select
              value={grupoId ?? ""}
              onChange={(e) =>
                setGrupoId(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">Sin grupo</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </select>
            <button type="button" onClick={nuevoGrupo}>
              + Nuevo
            </button>
          </span>
        </label>
      </div>

      {cargandoLista ? (
        <p>Cargando examen…</p>
      ) : preguntas.length === 0 ? (
        <p className="error">
          Este examen no tiene preguntas asociadas (revisa la tabla
          examen_preguntas).
        </p>
      ) : (
        <section className="fila-captura">
          {editando && (
            <p className="editando">
              Editando <strong>{editando}</strong> (se conserva su grupo).{" "}
              <button type="button" onClick={cancelarEdicion}>
                Cancelar
              </button>
            </p>
          )}

          <label>
            Código del estudiante
            <input
              ref={codigoRef}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  celdas.current[0]?.focus();
                }
              }}
              placeholder="INC-1"
              autoComplete="off"
              autoFocus
            />
          </label>

          <div className="celdas">
            {preguntas.map((p, i) => (
              <div key={p.pregunta_id} className="celda">
                <span>{p.numero}</span>
                <input
                  ref={(el) => {
                    celdas.current[i] = el;
                  }}
                  value={resp[i] ?? ""}
                  onChange={(e) => cambiarCelda(i, e.target.value)}
                  onKeyDown={(e) => teclaCelda(i, e)}
                  onFocus={(e) => e.target.select()}
                  autoComplete="off"
                  aria-label={`Pregunta ${p.numero}`}
                />
              </div>
            ))}
          </div>

          <p className="vista">
            A: {vista.literal} · B: {vista.inferencial} · C: {vista.critico} ·
            Respondidas: {contestadas} de {preguntas.length} →{" "}
            <strong>
              {vista.nivel
                ? ETIQUETA[vista.nivel]
                : `Excluido (menos de ${MIN_RESPUESTAS})`}
            </strong>
          </p>

          <button type="button" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar (Enter)"}
          </button>
          <p className="ayuda">
            Escribe A, B o C y avanza solo. Espacio o guion = sin responder.
            Retroceso vuelve a la casilla anterior.
          </p>
        </section>
      )}

      {mensaje && (
        <p role="alert" className={mensaje.tipo === "ok" ? "ok" : "error"}>
          {mensaje.texto}
        </p>
      )}

      {!cargandoLista && preguntas.length > 0 && (
        <section>
          <h2>Cargados en este examen ({intentos.length})</h2>

          <input
            className="buscador"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar por código…"
            autoComplete="off"
          />

          {filasLista.length === 0 ? (
            <p>
              {intentos.length === 0
                ? "Aún no hay respuestas cargadas en este examen."
                : "Ningún código coincide con la búsqueda."}
            </p>
          ) : (
            <>
              <div className="tabla-scroll">
                <table className="tabla-cargados">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Grupo</th>
                      {preguntas.map((p) => (
                        <th key={p.pregunta_id} className="l">
                          {p.numero}
                        </th>
                      ))}
                      <th>A</th>
                      <th>B</th>
                      <th>C</th>
                      <th>Resp.</th>
                      <th>Nivel</th>
                      <th>Cargado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map(
                      ({
                        intento,
                        letras,
                        literal,
                        inferencial,
                        critico,
                        total,
                        nivel,
                      }) => (
                        <tr
                          key={intento.id}
                          className={nivel ? "" : "excluido"}
                        >
                          <td>{intento.codigo}</td>
                          <td>{intento.grupo ?? "—"}</td>
                          {letras.map((l, i) => (
                            <td key={i} className="l">
                              {l ?? "·"}
                            </td>
                          ))}
                          <td>{literal}</td>
                          <td>{inferencial}</td>
                          <td>{critico}</td>
                          <td>{total}</td>
                          <td>{nivel ? ETIQUETA[nivel] : "Excluido"}</td>
                          <td>
                            {new Date(intento.enviado_en).toLocaleString(
                              "es-CO",
                              { dateStyle: "short", timeStyle: "short" },
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => editar(intento, letras)}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="paginacion">
                <button
                  type="button"
                  onClick={() => setPagina(paginaActual - 1)}
                  disabled={paginaActual === 0}
                >
                  ← Anterior
                </button>
                <span>
                  Página {paginaActual + 1} de {totalPaginas} (
                  {filasLista.length} estudiantes)
                </span>
                <button
                  type="button"
                  onClick={() => setPagina(paginaActual + 1)}
                  disabled={paginaActual >= totalPaginas - 1}
                >
                  Siguiente →
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
