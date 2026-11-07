interface Props {
  texto?: string;
  pagina?: boolean; // true = ocupa toda la pantalla y se centra
}

export default function Cargando({
  texto = "Cargando…",
  pagina = false,
}: Props) {
  return (
    <div
      className={pagina ? "cargando cargando-pagina" : "cargando"}
      role="status"
      aria-live="polite"
    >
      <span className="spinner" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}
