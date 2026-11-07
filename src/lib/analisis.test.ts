import { describe, it, expect } from "vitest";
import { armarFilas } from "./analisis";
import type { FilaResultado } from "./resultados";

let n = 0;
const r = (
  codigo: string,
  examen_id: number,
  literal: number,
  inferencial: number,
  critico: number,
): FilaResultado => ({
  intento_id: ++n,
  estudiante_codigo: codigo,
  grupo_id: null,
  grupo: null,
  examen_id,
  examen: "",
  tipo: examen_id === 1 ? "pre" : "post",
  literal,
  inferencial,
  critico,
  total: literal + inferencial + critico,
});

describe("armarFilas", () => {
  it("incluye al estudiante y calcula el cambio de nivel", () => {
    const [f] = armarFilas(
      [r("INC-1", 1, 6, 3, 1), r("INC-1", 2, 2, 3, 5)],
      1,
      2,
    );
    expect(f.incluido).toBe(true);
    expect(f.pre!.nivel).toBe("literal");
    expect(f.post!.nivel).toBe("critico");
    expect(f.cambio).toBe("mejoro");
  });

  it("excluye al estudiante que falta a una prueba", () => {
    const [f] = armarFilas([r("INC-2", 1, 10, 0, 0)], 1, 2);
    expect(f.incluido).toBe(false);
    expect(f.motivos).toEqual(["Sin Post-Test"]);
  });

  it("excluye con menos de 7 respuestas en una prueba", () => {
    const [f] = armarFilas(
      [r("INC-3", 1, 3, 2, 1), r("INC-3", 2, 5, 3, 2)],
      1,
      2,
    );
    expect(f.incluido).toBe(false);
    expect(f.motivos).toContain("Pre-Test con menos de 7 respuestas");
  });

  it("ordena los códigos de forma numérica", () => {
    const filas = armarFilas(
      [r("INC-10", 1, 8, 1, 1), r("INC-2", 1, 8, 1, 1)],
      1,
      2,
    );
    expect(filas.map((f) => f.codigo)).toEqual(["INC-2", "INC-10"]);
  });
});
