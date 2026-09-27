-- EventShare - Migración 0001: esquema inicial (PostgreSQL 15+ / Neon)
BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role    AS ENUM ('ADMIN', 'GUEST');
CREATE TYPE event_status AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');
CREATE TYPE post_status  AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Trigger genérico para updated_at
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────── users ─────────────────────────
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  email         citext      UNIQUE,
  password_hash text,
  google_id     text        UNIQUE,
  avatar_url    text,
  role          user_role   NOT NULL DEFAULT 'GUEST',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Un ADMIN siempre necesita email + contraseña; un GUEST puede ser anónimo (solo nombre)
  CONSTRAINT admin_requires_credentials
    CHECK (role <> 'ADMIN' OR (email IS NOT NULL AND password_hash IS NOT NULL))
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ───────────────────────── events ────────────────────────
CREATE TABLE events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name               text         NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description        text         CHECK (char_length(description) <= 1000),
  cover_image_url    text,
  primary_color      char(7)      NOT NULL DEFAULT '#1F2937'
                       CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  event_code         varchar(12)  NOT NULL UNIQUE
                       CHECK (event_code ~ '^[A-Z0-9]{6,12}$'),
  event_date         timestamptz,
  status             event_status NOT NULL DEFAULT 'ACTIVE',
  moderation_enabled boolean      NOT NULL DEFAULT true,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_owner ON events (owner_id, created_at DESC);
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ───────────────────── event_members ─────────────────────
CREATE TABLE event_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  is_blocked boolean     NOT NULL DEFAULT false,   -- bloqueo por evento
  blocked_at timestamptz,
  UNIQUE (event_id, user_id)
);
CREATE INDEX idx_members_user ON event_members (user_id);

-- ───────────────────────── posts ─────────────────────────
CREATE TABLE posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  photo_url      text,
  photo_key      text,                      -- clave del objeto en el storage (para borrarlo)
  message        text        CHECK (char_length(message) <= 500),
  status         post_status NOT NULL DEFAULT 'PENDING',
  likes_count    integer     NOT NULL DEFAULT 0,
  comments_count integer     NOT NULL DEFAULT 0,
  moderated_by   uuid        REFERENCES users(id) ON DELETE SET NULL,
  moderated_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,               -- borrado lógico
  CONSTRAINT post_has_content CHECK (photo_url IS NOT NULL OR message IS NOT NULL)
);
-- Feed con paginación por cursor (created_at, id)
CREATE INDEX idx_posts_feed ON posts (event_id, created_at DESC, id DESC)
  WHERE status = 'APPROVED' AND deleted_at IS NULL;
-- Cola de moderación
CREATE INDEX idx_posts_pending ON posts (event_id, created_at DESC)
  WHERE status = 'PENDING' AND deleted_at IS NULL;
CREATE INDEX idx_posts_user ON posts (user_id);

-- ─────────────────────── comments ────────────────────────
CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    text        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_comments_post ON comments (post_id, created_at ASC) WHERE deleted_at IS NULL;

-- ───────────────────────── likes ─────────────────────────
CREATE TABLE likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)                 -- un like por usuario y publicación
);
CREATE INDEX idx_likes_user ON likes (user_id);

-- ──────────────────── refresh_tokens ─────────────────────
CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text        NOT NULL UNIQUE,   -- SHA-256 del token; nunca el token en claro
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens (user_id);

-- ─────────── Contadores denormalizados (likes/comments) ───────────
CREATE FUNCTION trg_likes_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSE
    UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER likes_count_ins AFTER INSERT ON likes FOR EACH ROW EXECUTE FUNCTION trg_likes_count();
CREATE TRIGGER likes_count_del AFTER DELETE ON likes FOR EACH ROW EXECUTE FUNCTION trg_likes_count();

CREATE FUNCTION trg_comments_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER comments_count_ins AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION trg_comments_count();
CREATE TRIGGER comments_count_upd AFTER UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION trg_comments_count();

COMMIT;
