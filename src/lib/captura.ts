import { supabase } from "./supabase";
import type { Opcion } from "./clasificacion";
import { traerTodo } from "./resultados";

export interface ExamenResumen {
  id: number;
  nombre: string;
  tipo: "pre" | "post";
  activo: boolean;
}
export interface PreguntaExamen {
  pregunta_id: number;
  numero: number;
}
export interface Estudiante {
  codigo: string;
  nombre: string;
}

export async function listarExamenes(): Promise<ExamenResumen[]> {
  const { data, error } = await supabase
    .from("examenes")
    .select("id, nombre, tipo, activo")
    .order("tipo")
    .order("nombre");
  if (error) throw error;
  return data;
}

export async function listarPreguntasDeExamen(
  examenId: number,
): Promise<PreguntaExamen[]> {
  const { data, error } = await supabase
    .from("examen_preguntas")
    .select("pregunta_id, numero")
    .eq("examen_id", examenId)
    .order("numero");
  if (error) throw error;
  return data;
}

// ---------- Estudiantes ----------

export async function listarEstudiantes(): Promise<Estudiante[]> {
  return traerTodo<Estudiante>((desde, hasta) =>
    supabase
      .from("estudiantes")
      .select("codigo, nombre")
      .order("nombre")
      .order("codigo")
      .range(desde, hasta),
  );
}

export type ErrorEstudiante =
  "codigo_repetido" | "formato_invalido" | "desconocido";
export type ResultadoEstudiante =
  | { estudiante: Estudiante; error: null }
  | { estudiante: null; error: ErrorEstudiante };

function mapearError(code?: string): ErrorEstudiante {
  if (code === "23505") return "codigo_repetido"; // unique: el código ya existe
  if (code === "23514") return "formato_invalido"; // check: formato del código o nombre vacío
  return "desconocido";
}

export async function crearEstudiante(
  codigo: string,
  nombre: string,
): Promise<ResultadoEstudiante> {
  const { data, error } = await supabase
    .from("estudiantes")
    .insert({ codigo, nombre })
    .select("codigo, nombre")
    .single();
  if (error) return { estudiante: null, error: mapearError(error.code) };
  return { estudiante: data, error: null };
}

export async function actualizarEstudiante(
  codigoActual: string,
  codigo: string,
  nombre: string,
): Promise<ResultadoEstudiante> {
  const { data, error } = await supabase
    .from("estudiantes")
    .update({ codigo, nombre })
    .eq("codigo", codigoActual)
    .select("codigo, nombre")
    .single();
  if (error) return { estudiante: null, error: mapearError(error.code) };
  return { estudiante: data, error: null };
}

// ---------- Respuestas ----------

export type ErrorRegistro = "estudiante_no_existe" | "desconocido";

/** Devuelve null si todo salió bien, o el tipo de error. */
export async function registrarRespuestas(
  codigo: string,
  examenId: number,
  respuestas: Record<number, Opcion>, // id de pregunta → opción; las no contestadas se omiten
): Promise<ErrorRegistro | null> {
  const { error } = await supabase.rpc("registrar_respuestas", {
    p_codigo: codigo,
    p_examen_id: examenId,
    p_respuestas: respuestas,
  });
  if (!error) return null;
  if (error.code === "23503") return "estudiante_no_existe"; // llave foránea
  return "desconocido";
}

export interface IntentoCargado {
  id: number;
  codigo: string;
  nombre: string;
  enviado_en: string;
  respuestas: Record<number, Opcion>; // id de pregunta → opción
}

type IntentoCrudo = {
  id: number;
  estudiante_codigo: string;
  enviado_en: string;
  estudiantes: { nombre: string } | null;
  respuestas: { pregunta_id: number; opcion: Opcion }[];
};

const SELECT_INTENTO =
  "id, estudiante_codigo, enviado_en, estudiantes ( nombre ), respuestas ( pregunta_id, opcion )";

function aIntento(x: IntentoCrudo): IntentoCargado {
  const respuestas: Record<number, Opcion> = {};
  for (const r of x.respuestas) respuestas[r.pregunta_id] = r.opcion;
  return {
    id: x.id,
    codigo: x.estudiante_codigo,
    nombre: x.estudiantes?.nombre ?? x.estudiante_codigo,
    enviado_en: x.enviado_en,
    respuestas,
  };
}

/** Todos los intentos cargados en un examen, del más reciente al más antiguo. */
export async function listarIntentosDeExamen(
  examenId: number,
): Promise<IntentoCargado[]> {
  const crudos = await traerTodo<IntentoCrudo>((desde, hasta) =>
    supabase
      .from("intentos")
      .select(SELECT_INTENTO)
      .eq("examen_id", examenId)
      .order("enviado_en", { ascending: false })
      .order("id", { ascending: false })
      .range(desde, hasta),
  );
  return crudos.map(aIntento);
}

/** Un solo intento (para actualizar la lista después de guardar). */
export async function cargarIntento(
  codigo: string,
  examenId: number,
): Promise<IntentoCargado | null> {
  const { data, error } = await supabase
    .from("intentos")
    .select(SELECT_INTENTO)
    .eq("estudiante_codigo", codigo)
    .eq("examen_id", examenId)
    .maybeSingle();
  if (error) throw error;
  return data ? aIntento(data as unknown as IntentoCrudo) : null;
}

export async function eliminarIntentos(ids: number[]): Promise<void> {
  const { error } = await supabase.rpc("eliminar_intentos", { p_ids: ids });
  if (error) throw error;
}
