-- Evita reutilizar el mismo archivo subido en varias publicaciones
CREATE UNIQUE INDEX IF NOT EXISTS uq_posts_photo_key ON posts (photo_key) WHERE photo_key IS NOT NULL;
-- Listado de miembros bloqueados por evento
CREATE INDEX IF NOT EXISTS idx_members_blocked ON event_members (event_id) WHERE is_blocked;
