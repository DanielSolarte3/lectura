import { supabase } from "./supabase";

export interface FilaResultado {
  intento_id: number;
  estudiante_codigo: string;
  grupo_id: number | null;
  grupo: string | null;
  examen_id: number;
  examen: string;
  tipo: "pre" | "post";
  literal: number;
  inferencial: number;
  critico: number;
  total: number;
}

export interface FilaPregunta {
  examen_id: number;
  grupo_id: number | null;
  numero: number;
  texto_id: number | null;
  texto: string | null;
  a: number;
  b: number;
  c: number;
}

// La API devuelve máximo 1000 filas por consulta: se pide por páginas.
async function traerTodo<T>(
  consulta: (
    desde: number,
    hasta: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const TAM = 1000;
  const todo: T[] = [];
  for (let desde = 0; ; desde += TAM) {
    const { data, error } = await consulta(desde, desde + TAM - 1);
    if (error) throw error;
    todo.push(...((data ?? []) as T[]));
    if (!data || data.length < TAM) break;
  }
  return todo;
}

export const cargarResultados = () =>
  traerTodo<FilaResultado>((d, h) =>
    supabase.from("resultados").select("*").order("intento_id").range(d, h),
  );

export const cargarPorPregunta = () =>
  traerTodo<FilaPregunta>((d, h) =>
    supabase
      .from("conteo_por_pregunta")
      .select("*")
      .order("examen_id")
      .order("grupo_id")
      .order("numero")
      .range(d, h),
  );
