-- Admin login switches from password to TOTP (authenticator app). Shared account, shared secret.
ALTER TABLE admins ADD COLUMN totp_secret TEXT;
ALTER TABLE admins ADD COLUMN totp_last_step INTEGER NOT NULL DEFAULT 0; -- rejects replay of a used code
ALTER TABLE admins DROP COLUMN password_hash;
