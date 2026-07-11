
-- Set password for existing user and grant admin role (temporary access)
UPDATE auth.users
SET encrypted_password = crypt('gbomzy001', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'thomasagbona@gmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'thomasagbona@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
