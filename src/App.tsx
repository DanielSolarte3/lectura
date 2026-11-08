import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useSesion } from "./lib/useSesion";
import Cargando from "./components/Cargando";
import Login from "./pages/Login";
import Captura from "./pages/Captura";
import Resultados from "./pages/Resultados";
import Estudiantes from "./pages/Estudiantes";

function Protegida({ children }: { children: ReactNode }) {
  const { sesion, cargando } = useSesion();
  if (cargando) return <Cargando pagina />;
  return sesion ? <>{children}</> : <Navigate to="/login" replace />;
}

function SoloAdmin({ children }: { children: ReactNode }) {
  const { sesion, cargando } = useSesion();
  if (cargando) return <Cargando pagina />;
  if (!sesion) return <Navigate to="/login" replace />;
  return sesion.user.app_metadata?.rol === "admin" ? (
    <>{children}</>
  ) : (
    <Navigate to="/captura" replace />
  );
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
        <Route
          path="/estudiantes"
          element={
            <SoloAdmin>
              <Estudiantes />
            </SoloAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/captura" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
