import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEsAdmin } from "../lib/useSesion";

export default function Encabezado() {
  const navigate = useNavigate();
  const esAdmin = useEsAdmin();

  async function salir() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header className="encabezado">
      <nav>
        <NavLink to="/captura">Captura</NavLink>
        <NavLink to="/resultados">Resultados</NavLink>
        {esAdmin && <NavLink to="/estudiantes">Estudiantes</NavLink>}
      </nav>
      <button type="button" onClick={salir}>
        Salir
      </button>
    </header>
  );
}
