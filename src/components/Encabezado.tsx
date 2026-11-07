import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Encabezado() {
  const navigate = useNavigate();

  async function salir() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header className="encabezado">
      <nav>
        <NavLink to="/captura">Captura</NavLink>
        <NavLink to="/resultados">Resultados</NavLink>
      </nav>
      <button type="button" onClick={salir}>
        Salir
      </button>
    </header>
  );
}
