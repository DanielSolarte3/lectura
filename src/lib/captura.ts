import { supabase } from "./supabase";
import type { Opcion } from "./clasificacion";
import { traerTodo } from "./resultados";

export interface ExamenResumen {
  id: number;
  nombre: string;
  tipo: "pre" | "post";
  activo: boolean;
}
export interface Grupo {
  id: number;
  nombre: string;
}
export interface PreguntaExamen {
  pregunta_id: number;
  numero: number;
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

export async function listarGrupos(): Promise<Grupo[]> {
  const { data, error } = await supabase
    .from("grupos")
    .select("id, nombre")
    .order("nombre");
  if (error) throw error;
  return data;
}

export async function crearGrupo(nombre: string): Promise<Grupo> {
  const { data, error } = await supabase
    .from("grupos")
    .insert({ nombre })
    .select("id, nombre")
    .single();
  if (error) throw error;
  return data;
}

export async function existeIntento(
  codigo: string,
  examenId: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("intentos")
    .select("id")
    .eq("estudiante_codigo", codigo)
    .eq("examen_id", examenId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export type ErrorRegistro = "codigo_invalido" | "desconocido";

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
  if (error.code === "23514") return "codigo_invalido"; // check del formato del código
  return "desconocido";
}

export interface IntentoCargado {
  id: number;
  codigo: string;
  grupo_id: number | null;
  grupo: string | null;
  enviado_en: string;
  respuestas: Record<number, Opcion>; // id de pregunta → opción
}

type IntentoCrudo = {
  id: number;
  estudiante_codigo: string;
  enviado_en: string;
  estudiantes: {
    grupo_id: number | null;
    grupos: { nombre: string } | null;
  } | null;
  respuestas: { pregunta_id: number; opcion: Opcion }[];
};

const SELECT_INTENTO =
  "id, estudiante_codigo, enviado_en, estudiantes ( grupo_id, grupos ( nombre ) ), respuestas ( pregunta_id, opcion )";

function aIntento(x: IntentoCrudo): IntentoCargado {
  const respuestas: Record<number, Opcion> = {};
  for (const r of x.respuestas) respuestas[r.pregunta_id] = r.opcion;
  return {
    id: x.id,
    codigo: x.estudiante_codigo,
    grupo_id: x.estudiantes?.grupo_id ?? null,
    grupo: x.estudiantes?.grupos?.nombre ?? null,
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
