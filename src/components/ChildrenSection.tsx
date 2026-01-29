import React from 'react';
import { FormSection } from './FormSection';
import { FamilyMemberForm } from './FamilyMemberForm';
import { FormData, FamilyMember, createEmptyFamilyMember } from '@/types/form';
import { CopyBlockButton } from './CopyBlockButton';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ChildrenSectionProps {
  formData: FormData;
  updateFormData: (updates: Partial<FormData>) => void;
}

export const ChildrenSection: React.FC<ChildrenSectionProps> = ({ formData, updateFormData }) => {
  const updateKind = (index: number, updates: Partial<FamilyMember>) => {
    const newKinder = [...formData.kinder];
    newKinder[index] = { ...newKinder[index], ...updates };
    updateFormData({ kinder: newKinder });
  };
  
  const addChild = () => {
    updateFormData({
      kinder: [...formData.kinder, createEmptyFamilyMember()]
    });
  };
  
  const removeChild = (index: number) => {
    const newKinder = formData.kinder.filter((_, i) => i !== index);
    updateFormData({ kinder: newKinder });
  };

  return (
    <FormSection title="Angaben zu Kindern (optional)" variant="child">
      {formData.kinder.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p className="mb-4">Keine Kinder hinzugefügt.</p>
          <Button
            type="button"
            variant="outline"
            onClick={addChild}
            className="border-dashed border-accent text-accent hover:bg-accent/10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Kind hinzufügen
          </Button>
        </div>
      ) : (
        <>
          {formData.kinder.map((kind, index) => (
            <div key={index} className="relative">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium">Kind {index + 1}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeChild(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Entfernen
                </Button>
              </div>
              <FamilyMemberForm
                member={kind}
                updateMember={(updates) => updateKind(index, updates)}
                type="child"
                childIndex={index + 1}
                selectedKrankenkasse={formData.selectedKrankenkasse}
              />
              
              {/* Pre-filled Felder anzeigen (vom Antragsteller - bearbeitbar) */}
              <div className="mt-4 p-4 bg-card/50 rounded-lg border">
                <p className="text-sm text-muted-foreground mb-3">Vorausgefüllte Felder (vom Antragsteller - bearbeitbar):</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Krankenkasse (Kind)</Label>
                    <Input 
                      value={kind.bisherigBestandBei || formData.mitgliedKrankenkasse || ''} 
                      onChange={(e) => updateKind(index, { bisherigBestandBei: e.target.value })}
                      placeholder="Krankenkasse"
                      className="bg-card"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Vorname (letzte Vers.)</Label>
                    <Input 
                      value={kind.bisherigVorname || formData.mitgliedVorname || ''} 
                      onChange={(e) => updateKind(index, { bisherigVorname: e.target.value })}
                      placeholder="Vorname"
                      className="bg-card"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nachname (letzte Vers.)</Label>
                    <Input 
                      value={kind.bisherigNachname || formData.mitgliedName || ''} 
                      onChange={(e) => updateKind(index, { bisherigNachname: e.target.value })}
                      placeholder="Nachname"
                      className="bg-card"
                    />
                  </div>
                </div>
              </div>
              
              {/* Copy Block für Kind-Daten */}
              <CopyBlockButton
                label={`Kind ${index + 1} Daten`}
                data={{
                  vorname: kind.vorname,
                  name: kind.name,
                  geburtsdatum: kind.geburtsdatum,
                  geburtsname: kind.geburtsname || kind.name,
                  geburtsort: kind.geburtsort,
                  geburtsland: kind.geburtsland,
                  staatsangehoerigkeit: kind.staatsangehoerigkeit,
                  geschlecht: kind.geschlecht === 'm' ? 'Männlich' : kind.geschlecht === 'w' ? 'Weiblich' : kind.geschlecht,
                  verwandtschaft: kind.verwandtschaft === 'leiblich' ? 'Leibliches Kind' : 
                                  kind.verwandtschaft === 'stief' ? 'Stiefkind' : 
                                  kind.verwandtschaft === 'enkel' ? 'Enkelkind' : 
                                  kind.verwandtschaft === 'pflege' ? 'Pflegekind' : kind.verwandtschaft,
                }}
                fieldLabels={{
                  vorname: 'Vorname',
                  name: 'Name',
                  geburtsdatum: 'Geburtsdatum',
                  geburtsname: 'Geburtsname',
                  geburtsort: 'Geburtsort',
                  geburtsland: 'Geburtsland',
                  staatsangehoerigkeit: 'Staatsangehörigkeit',
                  geschlecht: 'Geschlecht',
                  verwandtschaft: 'Verwandtschaft',
                }}
              />
              
              {index < formData.kinder.length - 1 && (
                <hr className="my-6 border-accent/30" />
              )}
            </div>
          ))}
          
          <Button
            type="button"
            variant="outline"
            onClick={addChild}
            className="mt-4 w-full border-dashed border-accent text-accent hover:bg-accent/10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Weiteres Kind hinzufügen
          </Button>
          
          {formData.kinder.length > 3 && (
            <p className="mt-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <strong>Hinweis:</strong> Bei mehr als 3 Kindern werden mehrere PDFs erstellt. 
              Das erste PDF enthält die Kinder 1-3, das zweite PDF die Kinder 4-6, usw.
            </p>
          )}
        </>
      )}
    </FormSection>
  );
};
