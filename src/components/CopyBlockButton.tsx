import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Clipboard, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CopyBlockButtonProps {
  label: string;
  data: Record<string, string | undefined>;
  fieldLabels: Record<string, string>;
}

export const CopyBlockButton: React.FC<CopyBlockButtonProps> = ({ 
  label, 
  data, 
  fieldLabels 
}) => {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Build formatted text block
  const buildTextBlock = (): string => {
    const lines: string[] = [];
    
    Object.entries(fieldLabels).forEach(([key, fieldLabel]) => {
      const value = data[key];
      if (value && value.trim()) {
        lines.push(`${fieldLabel}: ${value}`);
      }
    });
    
    return lines.join('\n');
  };

  const textBlock = buildTextBlock();
  const hasData = textBlock.trim().length > 0;

  const handleCopy = async () => {
    if (!hasData) {
      toast.error('Keine Daten zum Kopieren');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(textBlock);
      setCopied(true);
      toast.success('Block in Zwischenablage kopiert!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  };

  if (!hasData) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="mt-4 border-t pt-4">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full flex items-center justify-between text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <Clipboard className="h-4 w-4" />
              {label} kopieren
            </span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-3 space-y-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <Textarea
              value={textBlock}
              readOnly
              className="font-mono text-xs bg-background/50 min-h-[100px] resize-none mb-3"
            />
            <Button
              onClick={handleCopy}
              size="sm"
              className={`w-full gap-2 transition-all duration-300 ${
                copied 
                  ? 'bg-green-600 hover:bg-green-600 text-white' 
                  : ''
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 animate-scale-in" />
                  Kopiert!
                </>
              ) : (
                <>
                  <Clipboard className="h-4 w-4" />
                  Gesamten Block kopieren
                </>
              )}
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
