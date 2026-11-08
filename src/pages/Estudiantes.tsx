import { useEffect, useMemo, useState } from "react";
import Encabezado from "../components/Encabezado";
import Cargando from "../components/Cargando";
import {
  listarEstudiantes,
  listarPruebasPorEstudiante,
  eliminarEstudiantes,
  type Estudiante,
} from "../lib/captura";

const TAM_PAGINA = 100;

// Para buscar sin importar mayúsculas ni tildes
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

type Orden = "nombre" | "numero";

// El número que va después del guion: "INC-7" → 7. Sin número, queda al final.
const numeroDelCodigo = (codigo: string) => {
  const m = codigo.match(/-(\d+)/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
};

const COMPARADORES: Record<Orden, (a: Estudiante, b: Estudiante) => number> = {

  // 2. Código, orden numérico por el número después del guion: 1, 2, 3… 10, 11
  numero: (a, b) => {
    const na = numeroDelCodigo(a.codigo);
    const nb = numeroDelCodigo(b.codigo);
    if (na !== nb) return na < nb ? -1 : 1;
    return a.codigo.localeCompare(b.codigo, "es"); // mismo número: por código
  },

  // 3. Nombre, orden alfabético
  nombre: (a, b) =>
    a.nombre.localeCompare(b.nombre, "es") ||
    a.codigo.localeCompare(b.codigo, "es"),
};

export default function Estudiantes() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [pruebas, setPruebas] = useState<Record<string, ("pre" | "post")[]>>(
    {},
  );
  const [orden, setOrden] = useState<Orden>("nombre");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [eliminando, setEliminando] = useState(false);
  const [mensaje, setMensaje] = useState<{
    tipo: "ok" | "error";
    texto: string;
  } | null>(null);

  useEffect(() => {
    Promise.all([listarEstudiantes(), listarPruebasPorEstudiante()])
      .then(([est, pr]) => {
        setEstudiantes(est);
        setPruebas(pr);
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return estudiantes
      .filter((e) => !q || normalizar(e.nombre).includes(q))
      .sort(COMPARADORES[orden]);
  }, [estudiantes, busqueda, orden]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAM_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = filtrados.slice(
    paginaActual * TAM_PAGINA,
    (paginaActual + 1) * TAM_PAGINA,
  );
  const codigosVisibles = visibles.map((e) => e.codigo);
  const todosMarcados =
    codigosVisibles.length > 0 &&
    codigosVisibles.every((c) => seleccion.has(c));

  function alternar(codigo: string) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(codigo)) n.delete(codigo);
      else n.add(codigo);
      return n;
    });
  }

  function alternarVisibles() {
    setSeleccion((s) => {
      const n = new Set(s);
      for (const c of codigosVisibles) {
        if (todosMarcados) n.delete(c);
        else n.add(c);
      }
      return n;
    });
  }

  async function eliminar(codigos: string[]) {
    if (codigos.length === 0 || eliminando) return;

    const afectados = estudiantes.filter((e) => codigos.includes(e.codigo));
    const conRespuestas = codigos.filter(
      (c) => (pruebas[c]?.length ?? 0) > 0,
    ).length;

    let texto =
      codigos.length === 1
        ? `¿Eliminar a ${afectados[0]?.nombre} (${codigos[0]}) y todas sus respuestas? Esta acción no se puede deshacer.`
        : `¿Eliminar a ${codigos.length} estudiantes y todas sus respuestas? Esta acción no se puede deshacer.`;
    if (conRespuestas > 0) {
      texto += `\n\n${conRespuestas === 1 && codigos.length === 1 ? "Este estudiante tiene" : `${conRespuestas} tienen`} respuestas cargadas, que también se borrarán.`;
    }
    if (!confirm(texto)) return;

    setEliminando(true);
    setMensaje(null);
    try {
      await eliminarEstudiantes(codigos);
      setEstudiantes((prev) => prev.filter((e) => !codigos.includes(e.codigo)));
      setPruebas((prev) => {
        const n = { ...prev };
        codigos.forEach((c) => delete n[c]);
        return n;
      });
      setSeleccion((prev) => {
        const n = new Set(prev);
        codigos.forEach((c) => n.delete(c));
        return n;
      });
      setMensaje({
        tipo: "ok",
        texto:
          codigos.length === 1
            ? `${afectados[0]?.nombre} eliminado.`
            : `${codigos.length} estudiantes eliminados.`,
      });
    } catch (e) {
      setMensaje({
        tipo: "error",
        texto:
          e instanceof Error && e.message === "sin_permiso"
            ? "Solo el administrador puede eliminar estudiantes."
            : "No se pudo eliminar. Revisa la conexión e intenta de nuevo.",
      });
    } finally {
      setEliminando(false);
    }
  }

  if (cargando) {
    return (
      <div className="captura">
        <Encabezado />
        <Cargando texto="Cargando estudiantes…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="captura">
        <Encabezado />
        <p className="error">
          No se pudo cargar la información. Recarga la página.
        </p>
      </div>
    );
  }

  return (
    <div className="captura">
      <Encabezado />
      <h1>Estudiantes</h1>
      <p className="ayuda">Total registrados: {estudiantes.length}</p>

      <div className="acciones-lista">
        <input
          className="buscador"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(0);
          }}
          placeholder="Buscar por nombre…"
          autoComplete="off"
        />
        <select
          value={orden}
          onChange={(e) => {
            setOrden(e.target.value as Orden);
            setPagina(0);
          }}
          aria-label="Ordenar por"
        >
          <option value="nombre">Orden: por nombre (A-Z)</option>
          <option value="numero">Orden: por código (número)</option>
        </select>
        {seleccion.size > 0 && (
          <>
            <button
              type="button"
              className="peligro"
              onClick={() => eliminar([...seleccion])}
              disabled={eliminando}
            >
              Eliminar seleccionados ({seleccion.size})
            </button>
            <button type="button" onClick={() => setSeleccion(new Set())}>
              Limpiar selección
            </button>
          </>
        )}
      </div>

      {mensaje && (
        <p role="alert" className={mensaje.tipo === "ok" ? "ok" : "error"}>
          {mensaje.texto}
        </p>
      )}

      {filtrados.length === 0 ? (
        <p>
          {estudiantes.length === 0
            ? "Aún no hay estudiantes registrados."
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
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Pruebas cargadas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => {
                  const cargadas = [...(pruebas[e.codigo] ?? [])]
                    .sort()
                    .reverse(); // "pre" antes que "post"
                  return (
                    <tr key={e.codigo}>
                      <td>
                        <input
                          type="checkbox"
                          checked={seleccion.has(e.codigo)}
                          onChange={() => alternar(e.codigo)}
                          aria-label={`Seleccionar ${e.nombre}`}
                        />
                      </td>
                      <td>{e.codigo}</td>
                      <td>{e.nombre}</td>
                      <td>
                        {cargadas.length === 0
                          ? "—"
                          : cargadas.map((t) => (
                              <span key={t} className="tag">
                                {t === "pre" ? "Pre" : "Post"}
                              </span>
                            ))}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="peligro"
                          onClick={() => eliminar([e.codigo])}
                          disabled={eliminando}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
              Página {paginaActual + 1} de {totalPaginas} ({filtrados.length}{" "}
              estudiantes)
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
    </div>
  );
}
