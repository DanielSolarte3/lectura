import { useEffect, useMemo, useState } from "react";
import Encabezado from "../components/Encabezado";
import Cargando from "../components/Cargando";
import {
  listarEstudiantes,
  listarPruebasPorEstudiante,
  eliminarEstudiantes,
  actualizarEstudiante,
  crearEstudiante,
  type Estudiante,
  type ErrorEstudiante,
} from "../lib/captura";

const TAM_PAGINA = 100;
const CODIGO_REGEX = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const MENSAJE_ERROR: Record<ErrorEstudiante, string> = {
  codigo_repetido: "Ya existe un estudiante con ese código.",
  formato_invalido:
    "El código solo puede tener letras, números y guiones (ej. INC-1), y el nombre no puede quedar vacío.",
  desconocido:
    "No se pudo guardar el cambio. Revisa la conexión e intenta de nuevo.",
};

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
  numero: (a, b) => {
    const na = numeroDelCodigo(a.codigo);
    const nb = numeroDelCodigo(b.codigo);
    if (na !== nb) return na < nb ? -1 : 1;
    return a.codigo.localeCompare(b.codigo, "es");
  },
  nombre: (a, b) =>
    a.nombre.localeCompare(b.nombre, "es") ||
    a.codigo.localeCompare(b.codigo, "es"),
};

interface Edicion {
  original: string;
  nombre: string;
  codigo: string;
}

export default function Estudiantes() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [pruebas, setPruebas] = useState<Record<string, ("pre" | "post")[]>>(
    {},
  );
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("nombre");
  const [pagina, setPagina] = useState(0);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [mensaje, setMensaje] = useState<{
    tipo: "ok" | "error";
    texto: string;
  } | null>(null);
  const [nuevo, setNuevo] = useState<{ nombre: string; codigo: string } | null>(
    null,
  );
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

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

  // ---------- Selección ----------

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

  // ---------- Edición ----------

  function abrirEdicion(e: Estudiante) {
    setEdicion({ original: e.codigo, nombre: e.nombre, codigo: e.codigo });
    setMensaje(null);
  }

  function teclaEdicion(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      guardarEdicion();
    } else if (ev.key === "Escape") {
      setEdicion(null);
    }
  }

  async function guardarEdicion() {
    if (!edicion || guardando) return;

    const original = edicion.original;
    const nombre = edicion.nombre.trim().replace(/\s+/g, " ");
    const codigo = edicion.codigo.trim().toUpperCase();

    if (!nombre) {
      return setMensaje({
        tipo: "error",
        texto: "El nombre no puede quedar vacío.",
      });
    }
    if (!CODIGO_REGEX.test(codigo)) {
      return setMensaje({
        tipo: "error",
        texto: MENSAJE_ERROR.formato_invalido,
      });
    }

    const actual = estudiantes.find((e) => e.codigo === original);
    if (actual && actual.nombre === nombre && actual.codigo === codigo) {
      setEdicion(null); // no hubo cambios
      return;
    }

    const homonimo = estudiantes.find(
      (e) =>
        e.codigo !== original && normalizar(e.nombre) === normalizar(nombre),
    );
    if (
      homonimo &&
      !confirm(
        `Ya existe un estudiante llamado "${homonimo.nombre}" (código ${homonimo.codigo}). ¿Guardar de todas formas?`,
      )
    )
      return;

    if (
      codigo !== original &&
      !confirm(
        `Vas a cambiar el código de ${original} a ${codigo}. Sus respuestas ya cargadas pasarán al código nuevo. ¿Continuar?`,
      )
    )
      return;

    setMensaje(null);
    setGuardando(true);
    const r = await actualizarEstudiante(original, codigo, nombre);
    setGuardando(false);

    if (r.estudiante === null) {
      return setMensaje({ tipo: "error", texto: MENSAJE_ERROR[r.error] });
    }

    const nuevo = r.estudiante;
    setEstudiantes((prev) =>
      prev.map((e) => (e.codigo === original ? nuevo : e)),
    );

    if (nuevo.codigo !== original) {
      setPruebas((prev) => {
        if (!prev[original]) return prev;
        const { [original]: movidas, ...resto } = prev;
        return { ...resto, [nuevo.codigo]: movidas };
      });
      setSeleccion((prev) => {
        if (!prev.has(original)) return prev;
        const n = new Set(prev);
        n.delete(original);
        n.add(nuevo.codigo);
        return n;
      });
    }

    setEdicion(null);
    setMensaje({ tipo: "ok", texto: "Datos del estudiante actualizados." });
  }

  // ---------- Creacion ----------

  function abrirNuevo() {
    setNuevo({ nombre: busqueda.trim(), codigo: "" }); // si ya escribiste un nombre en el buscador, lo reutiliza
    setMensaje(null);
  }

  async function guardarNuevo() {
    if (!nuevo || guardandoNuevo) return;

    const nombre = nuevo.nombre.trim().replace(/\s+/g, " ");
    const codigo = nuevo.codigo.trim().toUpperCase();

    if (!nombre) {
      return setMensaje({
        tipo: "error",
        texto: "Escribe el nombre del estudiante.",
      });
    }
    if (!CODIGO_REGEX.test(codigo)) {
      return setMensaje({
        tipo: "error",
        texto: MENSAJE_ERROR.formato_invalido,
      });
    }

    const homonimo = estudiantes.find(
      (e) => normalizar(e.nombre) === normalizar(nombre),
    );
    if (
      homonimo &&
      !confirm(
        `Ya existe un estudiante llamado "${homonimo.nombre}" (código ${homonimo.codigo}). ¿Guardar de todas formas?`,
      )
    )
      return;

    setMensaje(null);
    setGuardandoNuevo(true);
    const r = await crearEstudiante(codigo, nombre);
    setGuardandoNuevo(false);

    if (r.estudiante === null) {
      return setMensaje({ tipo: "error", texto: MENSAJE_ERROR[r.error] });
    }

    const est = r.estudiante;
    setEstudiantes((prev) => [...prev, est]);
    setNuevo(null);
    setPagina(0);
    setMensaje({ tipo: "ok", texto: `${est.nombre} agregado.` });
  }

  // ---------- Eliminación ----------

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
      if (edicion && codigos.includes(edicion.original)) setEdicion(null);
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
          <option value="nombre">Orden: nombre (A-Z)</option>
          <option value="numero">Orden: código (número)</option>
        </select>
        <button type="button" className="primario" onClick={abrirNuevo}>
          + Nuevo estudiante
        </button>
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
      {nuevo && (
        <form
          className="fila-captura form-estudiante"
          onSubmit={(e) => {
            e.preventDefault();
            guardarNuevo();
          }}
        >
          <h3>Nuevo estudiante</h3>
          <label>
            Nombre completo
            <input
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              autoComplete="off"
              autoFocus
            />
          </label>
          <label>
            Código
            <input
              value={nuevo.codigo}
              onChange={(e) =>
                setNuevo({ ...nuevo, codigo: e.target.value.toUpperCase() })
              }
              placeholder="INC-1"
              autoComplete="off"
            />
          </label>
          <div className="fila">
            <button type="submit" disabled={guardandoNuevo}>
              {guardandoNuevo ? "Guardando…" : "Guardar estudiante"}
            </button>
            <button type="button" onClick={() => setNuevo(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
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
                  const ed =
                    edicion && edicion.original === e.codigo ? edicion : null;

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

                      {ed ? (
                        <>
                          <td>
                            <input
                              value={ed.nombre}
                              onChange={(ev) =>
                                setEdicion({ ...ed, nombre: ev.target.value })
                              }
                              onKeyDown={teclaEdicion}
                              aria-label="Nombre del estudiante"
                              autoComplete="off"
                              autoFocus
                            />
                          </td>
                          <td>
                            <input
                              value={ed.codigo}
                              onChange={(ev) =>
                                setEdicion({
                                  ...ed,
                                  codigo: ev.target.value.toUpperCase(),
                                })
                              }
                              onKeyDown={teclaEdicion}
                              aria-label="Código del estudiante"
                              autoComplete="off"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{e.codigo}</td>
                          <td>{e.nombre}</td>
                        </>
                      )}

                      <td>
                        {cargadas.length === 0
                          ? "—"
                          : cargadas.map((t) => (
                              <span key={t} className="tag">
                                {t === "pre" ? "Pre" : "Post"}
                              </span>
                            ))}
                      </td>

                      <td className="acciones-fila">
                        {ed ? (
                          <>
                            <button
                              type="button"
                              className="primario"
                              onClick={guardarEdicion}
                              disabled={guardando}
                            >
                              {guardando ? "Guardando…" : "Guardar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEdicion(null)}
                              disabled={guardando}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => abrirEdicion(e)}
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
                              onClick={() => eliminar([e.codigo])}
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
                          </>
                        )}
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
