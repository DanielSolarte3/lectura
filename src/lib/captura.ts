import { supabase } from "./supabase";
import type { Opcion } from "./clasificacion";

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
  grupoId: number | null,
): Promise<ErrorRegistro | null> {
  const { error } = await supabase.rpc("registrar_respuestas", {
    p_codigo: codigo,
    p_examen_id: examenId,
    p_respuestas: respuestas,
    p_grupo_id: grupoId,
  });
  if (!error) return null;
  if (error.code === "23514") return "codigo_invalido"; // check del formato del código
  return "desconocido";
}
