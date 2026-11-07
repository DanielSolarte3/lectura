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
  listarEstudiantes,
  crearEstudiante,
  actualizarEstudiante,
  registrarRespuestas,
  listarIntentosDeExamen,
  cargarIntento,
  eliminarIntentos,
  type ExamenResumen,
  type PreguntaExamen,
  type IntentoCargado,
  type Estudiante,
  type ErrorEstudiante,
} from "../lib/captura";
import Cargando from "../components/Cargando";

const CODIGO_REGEX = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const TAM_PAGINA = 25;
const MAX_SUGERENCIAS = 50;
const ETIQUETA: Record<Nivel, string> = {
  literal: "Literal",
  inferencial: "Inferencial",
  critico: "Crítico",
};
const MENSAJE_ERROR_ESTUDIANTE: Record<ErrorEstudiante, string> = {
  codigo_repetido: "Ya existe un estudiante con ese código.",
  formato_invalido:
    "El código solo puede tener letras, números y guiones (ej. INC-1).",
  desconocido:
    "No se pudo guardar el estudiante. Revisa la conexión e intenta de nuevo.",
};

// Para buscar sin importar mayúsculas ni tildes
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const porNombre = (a: Estudiante, b: Estudiante) =>
  a.nombre.localeCompare(b.nombre, "es") || a.codigo.localeCompare(b.codigo);

interface FormEstudiante {
  modo: "nuevo" | "editar";
  nombre: string;
  codigo: string;
  original: string | null; // código antes de editar
}

export default function Captura() {
  const [examenes, setExamenes] = useState<ExamenResumen[]>([]);
  const [examenId, setExamenId] = useState<number | null>(null);
  const [preguntas, setPreguntas] = useState<PreguntaExamen[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [intentos, setIntentos] = useState<IntentoCargado[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);

  // Selección de estudiante
  const [seleccionado, setSeleccionado] = useState<Estudiante | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [enfocado, setEnfocado] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const [formulario, setFormulario] = useState<FormEstudiante | null>(null);
  const [guardandoEst, setGuardandoEst] = useState(false);

  // Captura de respuestas
  const [resp, setResp] = useState<(Opcion | null)[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [mensaje, setMensaje] = useState<{
    tipo: "ok" | "error";
    texto: string;
  } | null>(null);

  // Lista de cargados
  const [busquedaTabla, setBusquedaTabla] = useState("");
  const [pagina, setPagina] = useState(0);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());

  const buscadorRef = useRef<HTMLInputElement>(null);
  const celdas = useRef<(HTMLInputElement | null)[]>([]);

  // Carga inicial: exámenes y estudiantes
  useEffect(() => {
    Promise.all([listarExamenes(), listarEstudiantes()])
      .then(([ex, est]) => {
        setExamenes(ex);
        setEstudiantes(est);
        const inicial = ex.find((e) => e.tipo === "pre" && e.activo) ?? ex[0];
        if (inicial) setExamenId(inicial.id);
      })
      .catch(() => setErrorCarga(true));
  }, []);

  // Al cambiar de examen: preguntas + todo lo ya cargado en él
  useEffect(() => {
    if (examenId === null) return;
    let vigente = true;

    setCargandoLista(true);
    setPreguntas([]);
    setIntentos([]);
    setResp([]);
    setSeleccionado(null);
    setFormulario(null);
    setBusqueda("");
    setBusquedaTabla("");
    setPagina(0);
    setSeleccion(new Set());
    setMensaje(null);
    setEnfocado(false);

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

  // Al seleccionar un estudiante, el cursor pasa a la primera pregunta
  const codigoSel = seleccionado?.codigo ?? null;
  useEffect(() => {
    if (codigoSel) celdas.current[0]?.focus();
  }, [codigoSel]);

  const vista = useMemo(() => clasificar(contar(resp)), [resp]);
  const contestadas = vista.total;

  const intentoDe = useMemo(
    () => new Map(intentos.map((i) => [i.codigo, i])),
    [intentos],
  );

  const sugerencias = useMemo(() => {
    const q = normalizar(busqueda);
    return estudiantes
      .filter((e) => !q || normalizar(e.nombre).includes(q))
      .slice(0, MAX_SUGERENCIAS);
  }, [estudiantes, busqueda]);

  const filasLista = useMemo(() => {
    const q = normalizar(busquedaTabla);
    return intentos
      .filter((i) => !q || normalizar(i.nombre).includes(q))
      .map((intento) => {
        const letras = preguntas.map(
          (p) => intento.respuestas[p.pregunta_id] ?? null,
        );
        return { intento, letras, ...clasificar(contar(letras)) };
      });
  }, [intentos, preguntas, busquedaTabla]);

  const totalPaginas = Math.max(1, Math.ceil(filasLista.length / TAM_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = filasLista.slice(
    paginaActual * TAM_PAGINA,
    (paginaActual + 1) * TAM_PAGINA,
  );
  const idsVisibles = visibles.map((v) => v.intento.id);
  const todosMarcados =
    idsVisibles.length > 0 && idsVisibles.every((id) => seleccion.has(id));

  // ---------- Selección y edición de estudiantes ----------

  function elegir(est: Estudiante) {
    setEnfocado(false);
    const previo = intentoDe.get(est.codigo);
    setSeleccionado(est);
    setResp(
      preguntas.map((p) =>
        previo ? (previo.respuestas[p.pregunta_id] ?? null) : null,
      ),
    );
    setBusqueda("");
    setResaltado(0);
    setFormulario(null);
    setMensaje(null);
  }

  function quitarSeleccion() {
    setSeleccionado(null);
    setResp(Array(preguntas.length).fill(null));
    setBusqueda("");
    setResaltado(0);
  }

  function teclaBuscador(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((i) => Math.min(i + 1, sugerencias.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = sugerencias[resaltado];
      if (s) elegir(s);
    }
  }

  function abrirNuevo() {
    setEnfocado(false);
    setFormulario({
      modo: "nuevo",
      nombre: busqueda.trim(),
      codigo: "",
      original: null,
    });
    setMensaje(null);
  }

  function abrirEditar() {
    if (!seleccionado) return;
    setFormulario({
      modo: "editar",
      nombre: seleccionado.nombre,
      codigo: seleccionado.codigo,
      original: seleccionado.codigo,
    });
    setMensaje(null);
  }

  async function guardarEstudiante() {
    if (!formulario || guardandoEst) return;

    const nombre = formulario.nombre.trim().replace(/\s+/g, " ");
    const codigo = formulario.codigo.trim().toUpperCase();

    if (!nombre) {
      return setMensaje({
        tipo: "error",
        texto: "Escribe el nombre del estudiante.",
      });
    }
    if (!CODIGO_REGEX.test(codigo)) {
      return setMensaje({
        tipo: "error",
        texto: MENSAJE_ERROR_ESTUDIANTE.formato_invalido,
      });
    }

    // Aviso de posible duplicado por nombre
    const homonimo = estudiantes.find(
      (e) =>
        e.codigo !== formulario.original &&
        normalizar(e.nombre) === normalizar(nombre),
    );
    if (
      homonimo &&
      !confirm(
        `Ya existe un estudiante llamado "${homonimo.nombre}" (código ${homonimo.codigo}). ¿Guardar de todas formas?`,
      )
    )
      return;

    setMensaje(null);
    setGuardandoEst(true);
    const r =
      formulario.modo === "nuevo"
        ? await crearEstudiante(codigo, nombre)
        : await actualizarEstudiante(formulario.original!, codigo, nombre);
    setGuardandoEst(false);

    if (r.estudiante === null) {
      return setMensaje({
        tipo: "error",
        texto: MENSAJE_ERROR_ESTUDIANTE[r.error],
      });
    }

    const est = r.estudiante;
    const codigoAnterior = formulario.original;
    setEstudiantes((prev) =>
      [...prev.filter((e) => e.codigo !== codigoAnterior), est].sort(porNombre),
    );

    if (formulario.modo === "editar") {
      setIntentos((prev) =>
        prev.map((i) =>
          i.codigo === codigoAnterior
            ? { ...i, codigo: est.codigo, nombre: est.nombre }
            : i,
        ),
      );
      setSeleccionado(est);
      setFormulario(null);
      setMensaje({ tipo: "ok", texto: "Datos del estudiante actualizados." });
    } else {
      elegir(est);
      setMensaje({ tipo: "ok", texto: `${est.nombre} agregado.` });
    }
  }

  // ---------- Captura de respuestas ----------

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

  async function guardar() {
    if (guardando || examenId === null || !seleccionado) return;
    if (contestadas === 0) {
      return setMensaje({
        tipo: "error",
        texto: "No hay respuestas marcadas.",
      });
    }

    const est = seleccionado;
    const eraActualizacion = intentoDe.has(est.codigo);

    setMensaje(null);
    setGuardando(true);
    try {
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

      const fallo = await registrarRespuestas(est.codigo, examenId, payload);
      if (fallo) {
        return setMensaje({
          tipo: "error",
          texto:
            fallo === "estudiante_no_existe"
              ? "Ese estudiante ya no existe. Vuelve a buscarlo o agrégalo de nuevo."
              : "No se pudo guardar. Revisa la conexión e intenta de nuevo.",
        });
      }

      const nuevo = await cargarIntento(est.codigo, examenId).catch(() => null);
      if (nuevo) {
        setIntentos((prev) => [
          nuevo,
          ...prev.filter((x) => x.codigo !== nuevo.codigo),
        ]);
        setPagina(0);
      }

      setMensaje({
        tipo: "ok",
        texto: `${est.nombre} ${eraActualizacion ? "actualizado" : "guardado"}.`,
      });
      quitarSeleccion();
    } catch {
      setMensaje({
        tipo: "error",
        texto: "No se pudo guardar. Revisa la conexión e intenta de nuevo.",
      });
    } finally {
      setGuardando(false);
    }
  }

  // ---------- Lista de cargados ----------

  function editarIntento(intento: IntentoCargado) {
    const est = estudiantes.find((e) => e.codigo === intento.codigo) ?? {
      codigo: intento.codigo,
      nombre: intento.nombre,
    };
    elegir(est);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function alternar(id: number) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function alternarVisibles() {
    setSeleccion((s) => {
      const n = new Set(s);
      for (const id of idsVisibles) {
        if (todosMarcados) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  }

  async function eliminar(ids: number[]) {
    if (ids.length === 0 || eliminando) return;

    const afectados = intentos.filter((i) => ids.includes(i.id));
    const examen =
      examenes.find((e) => e.id === examenId)?.nombre ?? "este examen";
    const texto =
      ids.length === 1
        ? `¿Eliminar las respuestas de ${afectados[0]?.nombre} en ${examen}? Esta acción no se puede deshacer.`
        : `¿Eliminar las respuestas de ${ids.length} estudiantes en ${examen}? Esta acción no se puede deshacer.`;
    if (!confirm(texto)) return;

    setEliminando(true);
    setMensaje(null);
    try {
      await eliminarIntentos(ids);
      setIntentos((prev) => prev.filter((i) => !ids.includes(i.id)));
      setSeleccion((prev) => {
        const n = new Set(prev);
        ids.forEach((id) => n.delete(id));
        return n;
      });
      if (
        seleccionado &&
        afectados.some((i) => i.codigo === seleccionado.codigo)
      ) {
        quitarSeleccion();
      }
      setMensaje({
        tipo: "ok",
        texto:
          ids.length === 1
            ? `${afectados[0]?.nombre} eliminado de este examen.`
            : `${ids.length} filas eliminadas.`,
      });
    } catch {
      setMensaje({
        tipo: "error",
        texto: "No se pudo eliminar. Revisa la conexión e intenta de nuevo.",
      });
    } finally {
      setEliminando(false);
    }
  }

  if (errorCarga)
    return <p>No se pudo cargar la información. Recarga la página.</p>;
  if (examenId === null) {
    return (
      <div className="captura">
        <Encabezado />
        <Cargando />
      </div>
    );
  }

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
      </div>

      {cargandoLista ? (
        <Cargando texto="Cargando examen…" />
      ) : preguntas.length === 0 ? (
        <p className="error">
          Este examen no tiene preguntas asociadas (revisa la tabla
          examen_preguntas).
        </p>
      ) : (
        <section className="fila-captura">
          {formulario ? (
            <form
              className="form-estudiante"
              onSubmit={(e) => {
                e.preventDefault();
                guardarEstudiante();
              }}
            >
              <h3>
                {formulario.modo === "nuevo"
                  ? "Nuevo estudiante"
                  : "Editar estudiante"}
              </h3>
              <label>
                Nombre completo
                <input
                  value={formulario.nombre}
                  onChange={(e) =>
                    setFormulario({ ...formulario, nombre: e.target.value })
                  }
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <label>
                Código
                <input
                  value={formulario.codigo}
                  onChange={(e) =>
                    setFormulario({
                      ...formulario,
                      codigo: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="INC-1"
                  autoComplete="off"
                />
              </label>
              {formulario.modo === "editar" &&
                formulario.codigo.trim().toUpperCase() !==
                  formulario.original && (
                  <p className="ayuda">
                    Al cambiar el código, sus respuestas ya cargadas pasan al
                    código nuevo.
                  </p>
                )}
              <div className="fila">
                <button type="submit" disabled={guardandoEst}>
                  {guardandoEst ? "Guardando…" : "Guardar estudiante"}
                </button>
                <button type="button" onClick={() => setFormulario(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : seleccionado ? (
            <>
              <div className="estudiante-sel">
                <div>
                  <strong>{seleccionado.nombre}</strong>
                  <label className="codigo-auto">
                    Código
                    <input value={seleccionado.codigo} readOnly tabIndex={-1} />
                  </label>
                </div>
                <div className="fila">
                  <button type="button" onClick={abrirEditar}>
                    Editar datos
                  </button>
                  <button type="button" onClick={quitarSeleccion}>
                    Cambiar estudiante
                  </button>
                </div>
              </div>

              {intentoDe.has(seleccionado.codigo) && (
                <p className="editando">
                  Este estudiante ya tiene respuestas en este examen. Al guardar
                  se reemplazarán.
                </p>
              )}

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
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label={`Pregunta ${p.numero}`}
                    />
                  </div>
                ))}
              </div>

              <p className="vista">
                A: {vista.literal} · B: {vista.inferencial} · C: {vista.critico}{" "}
                · Respondidas: {contestadas} de {preguntas.length} →{" "}
                <strong>
                  {vista.nivel
                    ? ETIQUETA[vista.nivel]
                    : `Excluido (menos de ${MIN_RESPUESTAS})`}
                </strong>
              </p>

              <button
                type="button"
                className="primario"
                onClick={guardar}
                disabled={guardando}
              >
                {guardando ? "Guardando…" : "Guardar (Enter)"}
              </button>
              <p className="ayuda">
                Escribe A, B o C y avanza solo. Espacio o guion = sin responder.
                Retroceso vuelve a la casilla anterior.
              </p>
            </>
          ) : (
            <div className="campo">
              <span className="rotulo">Estudiante (busca por nombre)</span>
              <div className="fila">
                <div className="combo">
                  <input
                    ref={buscadorRef}
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value);
                      setResaltado(0);
                    }}
                    onFocus={() => setEnfocado(true)}
                    onBlur={() => setEnfocado(false)}
                    onKeyDown={teclaBuscador}
                    placeholder="Escribe el nombre…"
                    aria-label="Buscar estudiante por nombre"
                    autoComplete="off"
                  />
                  {enfocado && (
                    <ul className="sugerencias">
                      {sugerencias.map((e, i) => (
                        <li
                          key={e.codigo}
                          className={i === resaltado ? "activa" : ""}
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            elegir(e);
                          }}
                        >
                          <span>{e.nombre}</span>
                          {intentoDe.has(e.codigo) && (
                            <span className="tag">Ya cargado</span>
                          )}
                        </li>
                      ))}
                      {sugerencias.length === 0 && (
                        <li className="vacia">Ningún estudiante coincide.</li>
                      )}
                    </ul>
                  )}
                </div>
                <button type="button" onClick={abrirNuevo}>
                  + Nuevo estudiante
                </button>
              </div>
            </div>
          )}
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

          <div className="acciones-lista">
            <input
              className="buscador"
              value={busquedaTabla}
              onChange={(e) => {
                setBusquedaTabla(e.target.value);
                setPagina(0);
              }}
              placeholder="Buscar por nombre…"
              autoComplete="off"
            />
            {seleccion.size > 0 && (
              <>
                <button
                  type="button"
                  className="peligro"
                  onClick={() => eliminar([...seleccion])}
                  disabled={eliminando}
                >
                  Eliminar seleccionadas ({seleccion.size})
                </button>
                <button type="button" onClick={() => setSeleccion(new Set())}>
                  Limpiar selección
                </button>
              </>
            )}
          </div>

          {filasLista.length === 0 ? (
            <p>
              {intentos.length === 0
                ? "Aún no hay respuestas cargadas en este examen."
                : "Ningún nombre coincide con la búsqueda."}
            </p>
          ) : (
            <>
              <div className="tabla-scroll">
                <table className="tabla-cargados">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={todosMarcados}
                          onChange={alternarVisibles}
                          aria-label="Seleccionar todos los de esta página"
                        />
                      </th>
                      {/* <th>Nombre</th> */}
                      <th>Código</th>
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
                          <td>
                            <input
                              type="checkbox"
                              checked={seleccion.has(intento.id)}
                              onChange={() => alternar(intento.id)}
                              aria-label={`Seleccionar ${intento.nombre}`}
                            />
                          </td>
                          {/* <td>{intento.nombre}</td> */}
                          <td>{intento.codigo}</td>
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
                          <td className="acciones-fila">
                            <button
                              type="button"
                              onClick={() => editarIntento(intento)}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="peligro"
                              onClick={() => eliminar([intento.id])}
                              disabled={eliminando}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v5" />
                                <path d="M14 11v5" />
                              </svg>
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
