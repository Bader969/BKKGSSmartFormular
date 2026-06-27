import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { LoginForm } from "@/components/LoginForm";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) setAllowed(null);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.functions.invoke("auth-check-allowlist");
      if (cancelled) return;
      if (!data?.allowed) {
        await supabase.auth.signOut();
        setAllowed(false);
      } else {
        setAllowed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lädt…</div>;
  if (!session) return <LoginForm />;
  if (allowed === null) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Prüfe Zugriff…</div>;
  if (!allowed) return <LoginForm />;
  return <>{children}</>;
}