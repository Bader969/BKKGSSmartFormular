
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

UPDATE auth.users
SET encrypted_password = extensions.crypt('Ahmad19Bader96@KVSmart.', extensions.gen_salt('bf')),
    updated_at = now()
WHERE email = 'tarifygb@gmail.com';
