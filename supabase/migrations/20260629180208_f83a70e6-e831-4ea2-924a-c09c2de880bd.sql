ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS vertriebspartner TEXT,
  ADD COLUMN IF NOT EXISTS applicant_name TEXT,
  ADD COLUMN IF NOT EXISTS applicant_vorname TEXT,
  ADD COLUMN IF NOT EXISTS antragsform TEXT;