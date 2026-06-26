UPDATE auth.users
SET encrypted_password = crypt(encode(gen_random_bytes(32), 'base64'), gen_salt('bf')),
    updated_at = now()
WHERE email = 'tarifygb@gmail.com';