import React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'member' | 'spouse' | 'child' | 'signature' | 'info';

interface FormSectionProps {
  title: string;
  variant: Variant;
  children: React.ReactNode;
  id?: string;
}

// Semantic tokens — all colors come from index.css HSL vars.
// Each variant gets a distinct accent within the Navy Trust family.
const variantTokens: Record<Variant, { ring: string; bg: string; dot: string }> = {
  member:    { ring: 'var(--section-member)',    bg: 'var(--section-member-bg)',    dot: 'var(--section-member)' },
  spouse:    { ring: 'var(--section-spouse)',    bg: 'var(--section-spouse-bg)',    dot: 'var(--section-spouse)' },
  child:     { ring: 'var(--section-child)',     bg: 'var(--section-child-bg)',     dot: 'var(--section-child)' },
  signature: { ring: 'var(--section-signature)', bg: 'var(--section-signature-bg)', dot: 'var(--section-signature)' },
  info:      { ring: 'var(--section-info)',      bg: 'var(--section-info-bg)',      dot: 'var(--section-info)' },
};

export const FormSection: React.FC<FormSectionProps> = ({ title, variant, children, id }) => {
  const t = variantTokens[variant];
  return (
    <section
      id={id}
      className={cn(
        'group relative rounded-2xl border bg-card p-6 mb-6 transition-all duration-200',
        'shadow-card hover:shadow-elevated scroll-mt-24 animate-fade-in-up',
      )}
      style={{
        // Soft accent rail on the left + tinted top wash
        backgroundImage: `linear-gradient(180deg, hsl(${t.bg}) 0%, hsl(var(--card)) 60%)`,
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full"
        style={{ background: `hsl(${t.ring})` }}
      />
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-border/60">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: `hsl(${t.dot})` }}
        />
        <h2 className="font-display text-lg font-semibold text-foreground tracking-tight">
          {title}
        </h2>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
};
