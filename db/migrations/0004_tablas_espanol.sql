-- Renombra las tablas conservando datos, claves foraneas e indices.
BEGIN;

ALTER TABLE users RENAME TO usuarios;
ALTER TABLE events RENAME TO eventos;
ALTER TABLE event_members RENAME TO miembros_evento;
ALTER TABLE posts RENAME TO publicaciones;
ALTER TABLE comments RENAME TO comentarios;
ALTER TABLE likes RENAME TO me_gusta;
ALTER TABLE refresh_tokens RENAME TO tokens_renovacion;
ALTER TABLE rate_limit_buckets RENAME TO limites_solicitudes;

-- Los cuerpos PL/pgSQL necesitan las nuevas referencias explicitas.
CREATE OR REPLACE FUNCTION trg_likes_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE publicaciones SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSE
    UPDATE publicaciones SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_comments_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE publicaciones SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE publicaciones SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION consume_rate_limit(bucket_key text, max_requests integer, window_seconds integer)
RETURNS TABLE(allowed boolean, retry_after integer)
LANGUAGE plpgsql AS $$
DECLARE
  bucket limites_solicitudes%ROWTYPE;
  checked_at timestamptz := clock_timestamp();
BEGIN
  IF max_requests < 1 OR window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration';
  END IF;

  INSERT INTO limites_solicitudes AS existing (key_hash, count, resets_at)
  VALUES (bucket_key, 1, checked_at + make_interval(secs => window_seconds))
  ON CONFLICT (key_hash) DO UPDATE SET
    count = CASE WHEN existing.resets_at <= checked_at THEN 1
                 ELSE LEAST(existing.count, max_requests) + 1 END,
    resets_at = CASE WHEN existing.resets_at <= checked_at
                    THEN checked_at + make_interval(secs => window_seconds)
                    ELSE existing.resets_at END
  RETURNING * INTO bucket;

  RETURN QUERY SELECT bucket.count <= max_requests,
    GREATEST(1, CEIL(EXTRACT(EPOCH FROM bucket.resets_at - checked_at))::integer);
END;
$$;

COMMIT;
