import * as XLSX from "xlsx";
import {
  ETIQUETA,
  CAMBIO,
  sumarPorTexto,
  type FilaEstudiante,
  type SumaPregunta,
} from "./analisis";

export function exportarExcel(
  filas: FilaEstudiante[],
  sumas: { examen: string; preguntas: SumaPregunta[] }[],
  nombreArchivo: string,
) {
  const resultados = filas.map((f) => ({
    Estudiante: f.codigo,
    "Pre A": f.pre?.literal ?? "",
    "Pre B": f.pre?.inferencial ?? "",
    "Pre C": f.pre?.critico ?? "",
    "Pre respondidas": f.pre?.total ?? "",
    "Pre nivel": f.pre?.nivel ? ETIQUETA[f.pre.nivel] : "",
    "Post A": f.post?.literal ?? "",
    "Post B": f.post?.inferencial ?? "",
    "Post C": f.post?.critico ?? "",
    "Post respondidas": f.post?.total ?? "",
    "Post nivel": f.post?.nivel ? ETIQUETA[f.post.nivel] : "",
    Cambio: f.cambio ? CAMBIO[f.cambio] : "",
    Estado: f.incluido ? "Incluido" : "Excluido",
    Motivo: f.motivos.join("; "),
  }));

  const porPregunta = sumas.flatMap((s) =>
    s.preguntas.map((p) => ({
      Examen: s.examen,
      Pregunta: p.numero,
      Texto: p.texto ?? "",
      A: p.a,
      B: p.b,
      C: p.c,
    })),
  );

  const porTexto = sumas.flatMap((s) =>
    sumarPorTexto(s.preguntas).map((t) => ({
      Examen: s.examen,
      Texto: t.texto,
      Preguntas: t.preguntas.join(", "),
      A: t.a,
      B: t.b,
      C: t.c,
    })),
  );

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(resultados),
    "Resultados",
  );
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(porPregunta),
    "Por pregunta",
  );
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.json_to_sheet(porTexto),
    "Por texto",
  );
  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`);
}
