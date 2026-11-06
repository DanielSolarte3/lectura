export type Opcion = "A" | "B" | "C";
export type Nivel = "literal" | "inferencial" | "critico";

export interface Conteo {
  literal: number;
  inferencial: number;
  critico: number;
}

export interface Resultado extends Conteo {
  total: number;
  nivel: Nivel | null; // null = excluido del análisis (menos respuestas del mínimo)
}

// Qué nivel mide cada opción
const NIVEL_POR_OPCION: Record<Opcion, Nivel> = {
  A: "literal",
  B: "inferencial",
  C: "critico",
};

// Orden de prioridad para empates: el primero gana
const PRIORIDAD: Nivel[] = ["critico", "inferencial", "literal"];

export const MIN_RESPUESTAS = 7;

/** Cuenta respuestas por nivel. null/undefined = pregunta sin contestar. */
export function contar(respuestas: (Opcion | null | undefined)[]): Conteo {
  const conteo: Conteo = { literal: 0, inferencial: 0, critico: 0 };
  for (const r of respuestas) {
    if (r) conteo[NIVEL_POR_OPCION[r]]++;
  }
  return conteo;
}

/** Clasifica según los conteos: gana la mayoría; en empate, el nivel más cercano al crítico. */
export function clasificar(
  conteo: Conteo,
  minRespuestas: number = MIN_RESPUESTAS,
): Resultado {
  const total = conteo.literal + conteo.inferencial + conteo.critico;

  if (total < minRespuestas) {
    return { ...conteo, total, nivel: null };
  }

  const max = Math.max(conteo.literal, conteo.inferencial, conteo.critico);
  const nivel = PRIORIDAD.find((n) => conteo[n] === max)!;

  return { ...conteo, total, nivel };
}
