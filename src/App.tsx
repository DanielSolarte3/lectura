import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useSesion } from "./lib/useSesion";
import Login from "./pages/Login";
import Captura from "./pages/Captura";
import Resultados from "./pages/Resultados";
import Cargando from "./components/Cargando";

function Protegida({ children }: { children: ReactNode }) {
  const { sesion, cargando } = useSesion();
  if (cargando) return <Cargando pagina />;
  return sesion ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/captura"
          element={
            <Protegida>
              <Captura />
            </Protegida>
          }
        />
        <Route
          path="/resultados"
          element={
            <Protegida>
              <Resultados />
            </Protegida>
          }
        />
        <Route path="*" element={<Navigate to="/captura" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
