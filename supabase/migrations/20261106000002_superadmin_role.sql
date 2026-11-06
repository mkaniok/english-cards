-- Super admin: the app owner. Has every admin right, and other admins cannot touch the account.
-- (Separate migration: a new enum value cannot be used in the transaction that adds it.)
alter type public.app_role add value if not exists 'superadmin';
