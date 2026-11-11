import { useEffect, useMemo, useState } from "react";
import Encabezado from "../components/Encabezado";
import {
  MIN_RESPUESTAS,
  type Nivel,
  type Resultado,
} from "../lib/clasificacion";
import { listarExamenes, type ExamenResumen } from "../lib/captura";
import {
  cargarResultados,
  cargarPorPregunta,
  type FilaResultado,
  type FilaPregunta,
} from "../lib/resultados";
import {
  armarFilas,
  resumir,
  sumarPorPregunta,
  sumarPorTexto,
  ETIQUETA,
  CAMBIO,
  type SumaPregunta,
} from "../lib/analisis";
import { exportarExcel } from "../lib/exportar";
import Cargando from "../components/Cargando";

const NIVELES: Nivel[] = ["literal", "inferencial", "critico"];
const pct = (n: number, total: number) =>
  total ? `${Math.round((n * 100) / total)}%` : "—";
const conteo = (i: Resultado | null) =>
  i ? `${i.literal}-${i.inferencial}-${i.critico}` : "—";

export default function Resultados() {
  const [examenes, setExamenes] = useState<ExamenResumen[]>([]);
  const [resultados, setResultados] = useState<FilaResultado[]>([]);
  const [porPregunta, setPorPregunta] = useState<FilaPregunta[]>([]);
  const [preId, setPreId] = useState<number | null>(null);
  const [postId, setPostId] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([listarExamenes(), cargarResultados(), cargarPorPregunta()])
      .then(([ex, res, pp]) => {
        setExamenes(ex);
        setResultados(res);
        setPorPregunta(pp);
        const elegir = (tipo: "pre" | "post") =>
          (
            ex.find((e) => e.tipo === tipo && e.activo) ??
            ex.find((e) => e.tipo === tipo)
          )?.id ?? null;
        setPreId(elegir("pre"));
        setPostId(elegir("post"));
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, []);

  const filas = useMemo(
    () => armarFilas(resultados, preId, postId),
    [resultados, preId, postId],
  );
  const resumen = useMemo(() => resumir(filas), [filas]);
  const sumasPre = useMemo(
    () => sumarPorPregunta(porPregunta, preId, "todos"),
    [porPregunta, preId],
  );
  const sumasPost = useMemo(
    () => sumarPorPregunta(porPregunta, postId, "todos"),
    [porPregunta, postId],
  );

  const nombreExamen = (id: number | null) =>
    examenes.find((e) => e.id === id)?.nombre ?? "—";

  async function exportar() {
    const fecha = new Date().toISOString().slice(0, 10);
    await exportarExcel(
      filas,
      [
        {
          prueba: "Pre-Test",
          examen: nombreExamen(preId),
          preguntas: sumasPre,
        },
        {
          prueba: "Post-Test",
          examen: nombreExamen(postId),
          preguntas: sumasPost,
        },
      ],
      `resultados-lectura-${fecha}`,
    );
  }

  if (cargando) {
    return (
      <div className="captura">
        <Encabezado />
        <Cargando texto="Cargando resultados…" />
      </div>
    );
  }
  if (error)
    return <p>No se pudieron cargar los resultados. Recarga la página.</p>;

  return (
    <div className="captura">
      <Encabezado />
      <h1>Resultados</h1>

      <div className="controles">
        <label>
          Pre-Test
          <select
            value={preId ?? ""}
            onChange={(e) => setPreId(Number(e.target.value))}
          >
            {examenes
              .filter((e) => e.tipo === "pre")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
          </select>
        </label>
        <label>
          Post-Test
          <select
            value={postId ?? ""}
            onChange={(e) => setPostId(Number(e.target.value))}
          >
            {examenes
              .filter((e) => e.tipo === "post")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          className="primario"
          onClick={exportar}
          disabled={filas.length === 0}
        >
          Exportar a Excel
        </button>
      </div>

      <section>
        <h2>Resumen</h2>
        <p>
          {resumen.total} estudiantes · <strong>{resumen.incluidos}</strong>{" "}
          incluidos en el análisis · {resumen.excluidos} excluidos
        </p>
        <table>
          <thead>
            <tr>
              <th>Nivel</th>
              <th>Pre-Test</th>
              <th>Post-Test</th>
            </tr>
          </thead>
          <tbody>
            {NIVELES.map((n) => (
              <tr key={n}>
                <td>{ETIQUETA[n]}</td>
                <td>
                  {resumen.pre[n]} ({pct(resumen.pre[n], resumen.incluidos)})
                </td>
                <td>
                  {resumen.post[n]} ({pct(resumen.post[n], resumen.incluidos)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Mejoraron: <strong>{resumen.mejoraron}</strong> · Igual:{" "}
          <strong>{resumen.iguales}</strong> · Bajaron:{" "}
          <strong>{resumen.bajaron}</strong>
        </p>
      </section>

      <section>
        <h2>Por estudiante</h2>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Pre (A-B-C)</th>
                <th>Pre nivel</th>
                <th>Post (A-B-C)</th>
                <th>Post nivel</th>
                <th>Cambio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.codigo} className={f.incluido ? "" : "excluido"}>
                  <td>{f.codigo}</td>
                  <td>{conteo(f.pre)}</td>
                  <td>{f.pre?.nivel ? ETIQUETA[f.pre.nivel] : "—"}</td>
                  <td>{conteo(f.post)}</td>
                  <td>{f.post?.nivel ? ETIQUETA[f.post.nivel] : "—"}</td>
                  <td>{f.cambio ? CAMBIO[f.cambio] : "—"}</td>
                  <td>
                    {f.incluido
                      ? "Incluido"
                      : `Excluido: ${f.motivos.join("; ")}`}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={7}>No hay datos para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <TablaSumas
        tipo="pre"
        titulo={`${nombreExamen(preId)}`}
        sumas={sumasPre}
      />
      <TablaSumas
        tipo="post"
        titulo={`${nombreExamen(postId)}`}
        sumas={sumasPost}
      />
      <p className="ayuda">
        Las sumas por pregunta incluyen solo los intentos con al menos{" "}
        {MIN_RESPUESTAS} respuestas en ese examen.
      </p>
    </div>
  );
}

function TablaSumas({
  tipo,
  titulo,
  sumas,
}: {
  tipo: "pre" | "post";
  titulo: string;
  sumas: SumaPregunta[];
}) {
  if (sumas.length === 0) return null;
  const textos = sumarPorTexto(sumas);
  return (
    <section>
      <h1>{titulo + ` (${tipo})`}</h1>
      <h2>Por pregunta</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Pregunta</th>
              <th>Texto</th>
              <th>A</th>
              <th>B</th>
              <th>C</th>
            </tr>
          </thead>
          <tbody>
            {sumas.map((s) => (
              <tr key={s.numero}>
                <td>{s.numero}</td>
                <td>{s.texto ?? "—"}</td>
                <td>{s.a}</td>
                <td>{s.b}</td>
                <td>{s.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Por texto</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Texto</th>
              <th>Preguntas</th>
              <th>A</th>
              <th>B</th>
              <th>C</th>
            </tr>
          </thead>
          <tbody>
            {textos.map((t) => (
              <tr key={t.texto}>
                <td>{t.texto}</td>
                <td>{t.preguntas.join(", ")}</td>
                <td>{t.a}</td>
                <td>{t.b}</td>
                <td>{t.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
