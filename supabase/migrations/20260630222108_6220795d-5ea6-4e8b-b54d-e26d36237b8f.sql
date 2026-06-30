ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS parent_application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS person_role text,
  ADD COLUMN IF NOT EXISTS person_index int;

CREATE INDEX IF NOT EXISTS applications_parent_idx ON public.applications(parent_application_id);
CREATE UNIQUE INDEX IF NOT EXISTS applications_parent_person_unique
  ON public.applications(parent_application_id, person_role, person_index)
  WHERE parent_application_id IS NOT NULL;