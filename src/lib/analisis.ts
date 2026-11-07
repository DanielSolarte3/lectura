import {
  clasificar,
  MIN_RESPUESTAS,
  type Nivel,
  type Resultado,
} from "./clasificacion";
import type { FilaResultado, FilaPregunta } from "./resultados";

export const ETIQUETA: Record<Nivel, string> = {
  literal: "Literal",
  inferencial: "Inferencial",
  critico: "Crítico",
};

export type Cambio = "mejoro" | "igual" | "bajo";
export const CAMBIO: Record<Cambio, string> = {
  mejoro: "Mejoró",
  igual: "Igual",
  bajo: "Bajó",
};

const ORDEN: Record<Nivel, number> = { literal: 0, inferencial: 1, critico: 2 };

export type FiltroGrupo = "todos" | "sin" | number;
export const coincideGrupo = (grupoId: number | null, f: FiltroGrupo) =>
  f === "todos" || (f === "sin" ? grupoId === null : grupoId === f);

export interface FilaEstudiante {
  codigo: string;
  grupo_id: number | null;
  grupo: string | null;
  pre: Resultado | null;
  post: Resultado | null;
  motivos: string[]; // por qué queda excluido (vacío = incluido)
  incluido: boolean;
  cambio: Cambio | null; // solo si está incluido
}

/** Junta el Pre y el Post de cada estudiante y aplica las reglas de exclusión. */
export function armarFilas(
  resultados: FilaResultado[],
  preId: number | null,
  postId: number | null,
): FilaEstudiante[] {
  const mapa = new Map<string, FilaEstudiante>();

  for (const r of resultados) {
    const esPre = r.examen_id === preId;
    const esPost = r.examen_id === postId;
    if (!esPre && !esPost) continue;

    let fila = mapa.get(r.estudiante_codigo);
    if (!fila) {
      fila = {
        codigo: r.estudiante_codigo,
        grupo_id: r.grupo_id,
        grupo: r.grupo,
        pre: null,
        post: null,
        motivos: [],
        incluido: false,
        cambio: null,
      };
      mapa.set(r.estudiante_codigo, fila);
    }
    const intento = clasificar({
      literal: r.literal,
      inferencial: r.inferencial,
      critico: r.critico,
    });
    if (esPre) fila.pre = intento;
    if (esPost) fila.post = intento;
  }

  for (const f of mapa.values()) {
    if (!f.pre) f.motivos.push("Sin Pre-Test");
    else if (f.pre.nivel === null)
      f.motivos.push(`Pre-Test con menos de ${MIN_RESPUESTAS} respuestas`);
    if (!f.post) f.motivos.push("Sin Post-Test");
    else if (f.post.nivel === null)
      f.motivos.push(`Post-Test con menos de ${MIN_RESPUESTAS} respuestas`);

    f.incluido = f.motivos.length === 0;
    if (f.incluido) {
      const dif = ORDEN[f.post!.nivel!] - ORDEN[f.pre!.nivel!];
      f.cambio = dif > 0 ? "mejoro" : dif < 0 ? "bajo" : "igual";
    }
  }

  return [...mapa.values()].sort((a, b) =>
    a.codigo.localeCompare(b.codigo, undefined, { numeric: true }),
  );
}

export interface Resumen {
  total: number;
  incluidos: number;
  excluidos: number;
  pre: Record<Nivel, number>;
  post: Record<Nivel, number>;
  mejoraron: number;
  iguales: number;
  bajaron: number;
}

export function resumir(filas: FilaEstudiante[]): Resumen {
  const r: Resumen = {
    total: filas.length,
    incluidos: 0,
    excluidos: 0,
    pre: { literal: 0, inferencial: 0, critico: 0 },
    post: { literal: 0, inferencial: 0, critico: 0 },
    mejoraron: 0,
    iguales: 0,
    bajaron: 0,
  };
  for (const f of filas) {
    if (!f.incluido) {
      r.excluidos++;
      continue;
    }
    r.incluidos++;
    r.pre[f.pre!.nivel!]++;
    r.post[f.post!.nivel!]++;
    if (f.cambio === "mejoro") r.mejoraron++;
    else if (f.cambio === "bajo") r.bajaron++;
    else r.iguales++;
  }
  return r;
}

export interface SumaPregunta {
  numero: number;
  texto: string | null;
  a: number;
  b: number;
  c: number;
}
export interface SumaTexto {
  texto: string;
  preguntas: number[];
  a: number;
  b: number;
  c: number;
}

export function sumarPorPregunta(
  datos: FilaPregunta[],
  examenId: number | null,
  filtro: FiltroGrupo,
): SumaPregunta[] {
  const mapa = new Map<number, SumaPregunta>();
  for (const d of datos) {
    if (d.examen_id !== examenId || !coincideGrupo(d.grupo_id, filtro))
      continue;
    const s = mapa.get(d.numero) ?? {
      numero: d.numero,
      texto: d.texto,
      a: 0,
      b: 0,
      c: 0,
    };
    s.a += d.a;
    s.b += d.b;
    s.c += d.c;
    mapa.set(d.numero, s);
  }
  return [...mapa.values()].sort((x, y) => x.numero - y.numero);
}

export function sumarPorTexto(sumas: SumaPregunta[]): SumaTexto[] {
  const mapa = new Map<string, SumaTexto>();
  for (const s of sumas) {
    const clave = s.texto ?? "Sin texto";
    const t = mapa.get(clave) ?? {
      texto: clave,
      preguntas: [],
      a: 0,
      b: 0,
      c: 0,
    };
    t.preguntas.push(s.numero);
    t.a += s.a;
    t.b += s.b;
    t.c += s.c;
    mapa.set(clave, t);
  }
  return [...mapa.values()];
}
