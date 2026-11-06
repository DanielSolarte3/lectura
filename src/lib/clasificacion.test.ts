import { describe, it, expect } from "vitest";
import { clasificar, contar, type Opcion, type Nivel } from "./clasificacion";

const aRespuestas = (s: string) => s.split("") as Opcion[];

// [estudiante, respuestas P1..P10, literal, inferencial, critico, nivel según el PDF]
const casosPDF: [string, string, number, number, number, Nivel][] = [
  ["INC-1", "AAABABCBAB", 5, 4, 1, "literal"],
  ["INC-2", "ABAAABABAA", 7, 3, 0, "literal"],
  ["INC-3", "ABCABCCBBA", 3, 4, 3, "inferencial"],
  ["INC-4", "AAAAAAAAAA", 10, 0, 0, "literal"],
  ["INC-5", "AAAAAAABAA", 9, 1, 0, "literal"],
  ["INC-6", "AAAAAABAAA", 9, 1, 0, "literal"],
  ["INC-7", "CBACABCAAC", 4, 2, 4, "critico"],
  ["INC-8", "ABAAAAAAAB", 8, 2, 0, "literal"],
  ["INC-9", "ABACCBBCBA", 3, 4, 3, "inferencial"],
  ["INC-10", "AAAABCACAA", 7, 1, 2, "literal"],
  ["INC-11", "AAAAAAAAAA", 10, 0, 0, "literal"],
  ["INC-12", "BCCCABBCCB", 1, 4, 5, "critico"],
  ["INC-13", "AAABABCBCB", 4, 4, 2, "inferencial"],
  ["INC-14", "AAAAAABCAA", 8, 1, 1, "literal"],
  ["INLM-15", "CBAABABABA", 5, 4, 1, "literal"],
  ["INLM-16", "CAAAAAAACB", 7, 1, 2, "literal"],
  ["INLM-17", "BBACABCAAB", 4, 4, 2, "inferencial"],
  ["INLM-18", "AACCCABCAA", 5, 1, 4, "literal"],
  ["INLM-19", "AAABACAAAA", 8, 1, 1, "literal"],
  ["INLM-20", "AAABAAACAA", 8, 1, 1, "literal"],
  ["INLM-21", "AAABAAAAAA", 9, 1, 0, "literal"],
  ["INLM-22", "ACABABAAAA", 7, 2, 1, "literal"],
  ["INLM-23", "AABABBAAAA", 7, 3, 0, "literal"],
  ["INLM-24", "AABCAAABCA", 6, 2, 2, "literal"],
  ["INSF-25", "AAAAAABBAA", 8, 2, 0, "literal"],
  ["INSF-26", "ABABABBAAA", 6, 4, 0, "literal"],
  ["INSF-27", "ABCCBCCABB", 2, 4, 4, "critico"],
];

describe("clasificación con los datos del PDF", () => {
  it.each(casosPDF)("%s", (_id, resp, lit, inf, crit, nivel) => {
    const conteo = contar(aRespuestas(resp));
    expect(conteo).toEqual({ literal: lit, inferencial: inf, critico: crit });
    expect(clasificar(conteo).nivel).toBe(nivel);
  });
});

describe("reglas acordadas con el cliente", () => {
  it("4A, 3B, 3C es literal (mayoría)", () => {
    expect(clasificar({ literal: 4, inferencial: 3, critico: 3 }).nivel).toBe(
      "literal",
    );
  });

  it("empates se resuelven hacia el nivel más crítico", () => {
    expect(clasificar({ literal: 4, inferencial: 4, critico: 2 }).nivel).toBe(
      "inferencial",
    );
    expect(clasificar({ literal: 4, inferencial: 2, critico: 4 }).nivel).toBe(
      "critico",
    );
    expect(clasificar({ literal: 2, inferencial: 4, critico: 4 }).nivel).toBe(
      "critico",
    );
    expect(clasificar({ literal: 5, inferencial: 0, critico: 5 }).nivel).toBe(
      "critico",
    );
  });

  it("con menos de 7 respuestas queda excluido (nivel null)", () => {
    const r = clasificar({ literal: 4, inferencial: 1, critico: 1 }); // 6 respuestas
    expect(r.total).toBe(6);
    expect(r.nivel).toBeNull();
  });

  it("con exactamente 7 respuestas sí se clasifica", () => {
    expect(clasificar({ literal: 4, inferencial: 2, critico: 1 }).nivel).toBe(
      "literal",
    );
  });

  it("las preguntas sin contestar no cuentan", () => {
    const conteo = contar([
      "A",
      "A",
      null,
      "B",
      undefined,
      "C",
      "A",
      "A",
      "A",
      "B",
    ]);
    expect(conteo).toEqual({ literal: 5, inferencial: 2, critico: 1 });
  });
});
