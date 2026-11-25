CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  name text NOT NULL,
  paused boolean NOT NULL DEFAULT false,
  rules_version text NOT NULL DEFAULT 'v2.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS participants (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  initials text NOT NULL,
  avatar_tone smallint NOT NULL CHECK (avatar_tone BETWEEN 0 AND 5),
  message text NOT NULL DEFAULT '',
  sort_order smallint NOT NULL CHECK (sort_order > 0),
  UNIQUE (event_id, sort_order)
);
CREATE INDEX IF NOT EXISTS participants_event_idx ON participants(event_id, sort_order);

CREATE TABLE IF NOT EXISTS pool_states (
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pool text NOT NULL CHECK (pool IN ('good', 'bad')),
  start_participant_id text NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  current_participant_id text NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  complete boolean NOT NULL DEFAULT false,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, pool)
);

CREATE TABLE IF NOT EXISTS draws (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pool text NOT NULL CHECK (pool IN ('good', 'bad')),
  sequence smallint NOT NULL CHECK (sequence > 0),
  slot_number smallint NOT NULL CHECK (slot_number BETWEEN 1 AND 50),
  drawer_id text NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  provider_id text NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 16 AND 100),
  fingerprint text NOT NULL,
  actor_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, pool, sequence),
  UNIQUE (event_id, pool, slot_number),
  UNIQUE (event_id, pool, drawer_id),
  UNIQUE (event_id, pool, provider_id),
  UNIQUE (event_id, pool, idempotency_key)
);
CREATE INDEX IF NOT EXISTS draws_event_pool_created_idx ON draws(event_id, pool, created_at DESC);
CREATE INDEX IF NOT EXISTS draws_drawer_idx ON draws(drawer_id);
CREATE INDEX IF NOT EXISTS draws_provider_idx ON draws(provider_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actor_user_id text NOT NULL,
  actor_name text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  detail text NOT NULL,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_event_created_idx ON audit_logs(event_id, created_at DESC);
