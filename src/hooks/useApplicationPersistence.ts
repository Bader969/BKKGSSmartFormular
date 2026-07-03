import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FormData } from "@/types/form";
import { deriveAntragsform } from "@/utils/antragsform";

type SaveArgs = { applicationId?: string | null; formData: FormData };

export function useApplicationPersistence() {
  const [saving, setSaving] = useState(false);

  const call = useCallback(async <T,>(action: string, body: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke<T>("applications-api", {
      body: { action, ...body },
    });
    if (error) throw error;
    return data as T;
  }, []);

  const save = useCallback(async ({ applicationId, formData }: SaveArgs) => {
    setSaving(true);
    try {
      const res = await call<{ application: { id: string } }>("save", {
        application_id: applicationId ?? undefined,
        krankenkasse: formData.selectedKrankenkasse ?? "unselected",
        payload: formData,
        vertriebspartner: formData.vertriebspartner ?? "",
        applicant_name: formData.mitgliedName ?? "",
        applicant_vorname: formData.mitgliedVorname ?? "",
        antragsform: deriveAntragsform(formData),
      });
      return res.application;
    } finally {
      setSaving(false);
    }
  }, [call]);

  const markExported = useCallback(
    (applicationId: string, pdfCount: number) => call("mark-exported", { application_id: applicationId, pdf_count: pdfCount }),
    [call],
  );

  const list = useCallback(() => call<{
    applications: Array<{
      id: string; user_id: string; krankenkasse: string; status: string;
      pdf_count: number; exported_at: string | null; last_opened_at: string | null;
      created_at: string; updated_at: string;
      vertriebspartner: string | null;
      applicant_name: string | null;
      applicant_vorname: string | null;
      antragsform: string | null;
      parent_application_id: string | null;
      person_role: string | null;
      person_index: number | null;
      source: string | null;
    }>;
    isAdmin: boolean;
    userEmails: Record<string, string>;
    userDisplayNames: Record<string, string>;
  }>("list"), [call]);

  const decrypt = useCallback((applicationId: string) => call<{ payload: FormData; krankenkasse: string }>("decrypt", { application_id: applicationId }), [call]);
  const remove = useCallback((applicationId: string) => call<{ ok: true }>("delete", { application_id: applicationId }), [call]);
  const events = useCallback((applicationId: string) => call<{ events: Array<{ id: string; event_type: string; meta: Record<string, unknown>; created_at: string; user_id: string }> }>("events", { application_id: applicationId }), [call]);

  return { saving, save, markExported, list, decrypt, remove, events };
}