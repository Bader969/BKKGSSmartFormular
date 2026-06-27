import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LoginFormProps {
  onLogin?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError('Ungültige E-Mail oder Passwort');
        return;
      }
      onLogin?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 10%, hsl(var(--primary-glow) / 0.35), transparent 40%), radial-gradient(circle at 80% 90%, hsl(var(--accent) / 0.3), transparent 45%)',
        }}
      />
      <div className="w-full max-w-md relative">
        <div className="bg-card rounded-2xl shadow-elevated p-8 border border-border/60 animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-primary/15">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">Smart Formular</h1>
            <p className="text-muted-foreground mt-2 text-sm">Bitte melden Sie sich an, um fortzufahren</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">E-Mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder="E-Mail eingeben"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Passwort</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  placeholder="Passwort eingeben"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/30">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 text-base font-medium">
              {loading ? 'Anmelden…' : 'Anmelden'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
