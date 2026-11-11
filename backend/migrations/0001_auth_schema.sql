-- 0001_auth_schema.sql — Kumbuild auth foundation (Phases A-B).
-- Source of truth: backend/README.md §4 and AUTH_PLAN.md §3.
-- NOTE: the orders table does NOT exist yet (Phases 4-6), so
-- order_notes.order_id is a plain text column with NO foreign key for now.
-- When orders land, add the FK in a later migration.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- enums
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'customer_service', 'customer');
CREATE TYPE user_status AS ENUM ('active', 'disabled', 'pending', 'invited');
CREATE TYPE auth_token_kind AS ENUM ('otp', 'reset', 'invite');
CREATE TYPE outbox_status AS ENUM ('pending', 'sent', 'failed');

-- ---------------------------------------------------------------- users
CREATE TABLE users (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name        text        NOT NULL,
    email            citext      NOT NULL UNIQUE,
    password_hash    text        NOT NULL,
    phone_no         text        NOT NULL,
    whatsapp_no      text        NOT NULL,
    alternative_email citext     UNIQUE,
    role             user_role   NOT NULL DEFAULT 'customer',
    status           user_status NOT NULL DEFAULT 'pending',
    email_verified_at timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------- billing addresses
-- Customer ONLY. Staff never get a billing address row.
CREATE TABLE billing_addresses (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    billing_name  text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    city          text NOT NULL,
    state         text NOT NULL,
    pincode       char(6) NOT NULL,
    country       text NOT NULL DEFAULT 'India',
    gstin         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- sessions
-- Custom session-cookie auth. NEVER JWT: a session is revoked by deleting
-- its row. Only the SHA-256 hash of the cookie token is stored.
CREATE TABLE sessions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL, -- 7 days absolute from login
    last_seen_at timestamptz NOT NULL DEFAULT now(), -- idle timeout 24h
    ip          inet,
    user_agent  text
);

-- ------------------------------------------------------------- auth tokens
-- One table for OTP (6-digit, 10 min), reset (32-byte, 30 min) and invite
-- (32-byte, 24h) tokens. kind is ALWAYS checked on use — an invite token
-- can never reset a password and vice versa.
CREATE TABLE auth_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind       auth_token_kind NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    attempts   int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------- audit logs
CREATE TABLE audit_logs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL, -- NULL = system action
    action        text NOT NULL,
    target_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
    details       jsonb NOT NULL DEFAULT '{}', -- before/after role+status etc.
    ip            inet,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------- order notes
-- order_id is plain text for now: the orders table does not exist yet
-- (Phases 4-6). Add a FK in a later migration once orders land.
CREATE TABLE order_notes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       text NOT NULL,
    author_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    note           text NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------- email outbox
-- DB-backed outbox for transactional mail. An OTP is NEVER silently dropped:
-- a failed send stays 'failed' with last_error, is retried up to 5 times by
-- the reaper, and the caller gets the error (500), not a fake success.
CREATE TABLE email_outbox (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind         text NOT NULL DEFAULT 'transactional'
                 CHECK (kind IN ('transactional', 'promotional')),
    to_email     citext NOT NULL,
    to_name      text,
    subject      text NOT NULL,
    html_content text NOT NULL,
    text_content text,
    status       outbox_status NOT NULL DEFAULT 'pending',
    attempts     int NOT NULL DEFAULT 0,
    last_error   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ indexes
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_auth_tokens_user_kind ON auth_tokens (user_id, kind);
CREATE INDEX idx_auth_tokens_token_hash ON auth_tokens (token_hash);
CREATE INDEX idx_audit_logs_actor_created ON audit_logs (actor_user_id, created_at);
CREATE INDEX idx_order_notes_order_created ON order_notes (order_id, created_at DESC);
CREATE INDEX idx_email_outbox_status_created ON email_outbox (status, created_at);
