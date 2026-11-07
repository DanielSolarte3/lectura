import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export function useSesion() {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) =>
      setSesion(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return { sesion, cargando };
}
