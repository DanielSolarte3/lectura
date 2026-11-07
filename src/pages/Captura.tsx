import { useEffect, useMemo, useRef, useState } from "react";
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
  type ExamenResumen,
  type Grupo,
  type PreguntaExamen,
} from "../lib/captura";
import Encabezado from "../components/Encabezado";

const CODIGO_REGEX = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const ETIQUETA: Record<Nivel, string> = {
  literal: "Literal",
  inferencial: "Inferencial",
  critico: "Crítico",
};

interface Guardado {
  codigo: string;
  literal: number;
  inferencial: number;
  critico: number;
  total: number;
  nivel: Nivel | null;
}

export default function Captura() {
  const [examenes, setExamenes] = useState<ExamenResumen[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [examenId, setExamenId] = useState<number | null>(null);
  const [grupoId, setGrupoId] = useState<number | null>(null);
  const [preguntas, setPreguntas] = useState<PreguntaExamen[]>([]);

  const [codigo, setCodigo] = useState("");
  const [resp, setResp] = useState<(Opcion | null)[]>([]);
  const [guardados, setGuardados] = useState<Guardado[]>([]);
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

  // Al cambiar de examen, cargar sus preguntas y limpiar la fila en curso
  useEffect(() => {
    if (examenId === null) return;
    listarPreguntasDeExamen(examenId)
      .then((ps) => {
        setPreguntas(ps);
        setResp(Array(ps.length).fill(null));
        setCodigo("");
        setMensaje(null);
      })
      .catch(() => setErrorCarga(true));
  }, [examenId]);

  const vista = useMemo(() => clasificar(contar(resp)), [resp]);
  const contestadas = vista.total;

  function cambiarCelda(i: number, valor: string) {
    const v = valor.slice(-1).toUpperCase();
    const poner = (op: Opcion | null) =>
      setResp((r) => r.map((x, j) => (j === i ? op : x)));

    if (v === "A" || v === "B" || v === "C") {
      poner(v as Opcion);
      celdas.current[i + 1]?.focus();
    } else if (v === "-" || v === " ") {
      poner(null); // pregunta sin contestar
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

    setMensaje(null);
    setGuardando(true);
    try {
      if (
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

      const fallo = await registrarRespuestas(cod, examenId, payload, grupoId);
      if (fallo) {
        return setMensaje({
          tipo: "error",
          texto:
            fallo === "codigo_invalido"
              ? "El código no tiene un formato válido."
              : "No se pudo guardar. Revisa la conexión e intenta de nuevo.",
        });
      }

      setGuardados((g) => [{ codigo: cod, ...vista }, ...g].slice(0, 30));
      setMensaje({ tipo: "ok", texto: `${cod} guardado.` });
      setCodigo("");
      setResp(Array(preguntas.length).fill(null));
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

      {preguntas.length === 0 ? (
        <p className="error">
          Este examen no tiene preguntas asociadas (revisa la tabla
          examen_preguntas).
        </p>
      ) : (
        <section className="fila-captura">
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

      {guardados.length > 0 && (
        <>
          <h2>Guardados en esta sesión</h2>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>A</th>
                <th>B</th>
                <th>C</th>
                <th>Resp.</th>
                <th>Nivel</th>
              </tr>
            </thead>
            <tbody>
              {guardados.map((g, i) => (
                <tr key={`${g.codigo}-${i}`}>
                  <td>{g.codigo}</td>
                  <td>{g.literal}</td>
                  <td>{g.inferencial}</td>
                  <td>{g.critico}</td>
                  <td>{g.total}</td>
                  <td>{g.nivel ? ETIQUETA[g.nivel] : "Excluido"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
