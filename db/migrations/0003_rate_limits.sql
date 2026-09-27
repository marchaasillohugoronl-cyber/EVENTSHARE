-- Las claves se guardan como SHA-256 para no almacenar emails ni IP en claro.
CREATE TABLE rate_limit_buckets (
  key_hash text PRIMARY KEY,
  count integer NOT NULL CHECK (count > 0),
  resets_at timestamptz NOT NULL
);
CREATE INDEX idx_rate_limit_expiry ON rate_limit_buckets (resets_at);

CREATE FUNCTION consume_rate_limit(bucket_key text, max_requests integer, window_seconds integer)
RETURNS TABLE(allowed boolean, retry_after integer)
LANGUAGE plpgsql AS $$
DECLARE
  bucket rate_limit_buckets%ROWTYPE;
  checked_at timestamptz := clock_timestamp();
BEGIN
  IF max_requests < 1 OR window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration';
  END IF;

  INSERT INTO rate_limit_buckets AS existing (key_hash, count, resets_at)
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
