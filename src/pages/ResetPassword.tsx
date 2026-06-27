import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setHasRecovery(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Mindestens 8 Zeichen."); return; }
    if (password !== confirm) { toast.error("Passwörter stimmen nicht überein."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Passwort gesetzt. Bitte erneut anmelden.");
      await supabase.auth.signOut();
      navigate("/");
    } catch {
      toast.error("Konnte Passwort nicht setzen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-elevated p-8 border border-border/60">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-center">Neues Passwort setzen</h1>
        {!hasRecovery && (
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Öffnen Sie diesen Link aus Ihrer Passwort-Reset-E-Mail.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="pw">Neues Passwort</Label>
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw2">Passwort bestätigen</Label>
            <Input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          </div>
          <Button type="submit" disabled={loading || !hasRecovery} className="w-full h-11">
            {loading ? "Speichern…" : "Passwort aktualisieren"}
          </Button>
        </form>
      </div>
    </div>
  );
}