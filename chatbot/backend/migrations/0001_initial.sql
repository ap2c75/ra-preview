PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS partner_registry_versions (
  version TEXT PRIMARY KEY,
  effective_from TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  retention_days INTEGER NOT NULL CHECK(retention_days = 90),
  effective_from TEXT NOT NULL,
  effective_until TEXT,
  registry_version TEXT NOT NULL REFERENCES partner_registry_versions(version),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  pii_ciphertext TEXT NOT NULL,
  pii_iv TEXT NOT NULL,
  pii_key_version TEXT NOT NULL,
  selected_products_json TEXT NOT NULL DEFAULT '[]',
  unresolved_json TEXT NOT NULL DEFAULT '[]',
  source_url TEXT,
  status TEXT NOT NULL CHECK(status IN ('queued','received','consulting','completed')),
  assigned_partner_id TEXT REFERENCES partners(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_partner_status ON leads(assigned_partner_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS leads_expiry ON leads(expires_at);

CREATE TABLE IF NOT EXISTS consent_events (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  policy_version TEXT NOT NULL,
  registry_version TEXT NOT NULL,
  recipients_json TEXT NOT NULL,
  collection_use INTEGER NOT NULL CHECK(collection_use = 1),
  third_party INTEGER NOT NULL CHECK(third_party = 1),
  over_14 INTEGER NOT NULL CHECK(over_14 = 1),
  agreed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_sessions_expiry ON customer_sessions(expires_at);

CREATE TABLE IF NOT EXISTS recovery_codes (
  lead_id TEXT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_access_keys (
  id TEXT PRIMARY KEY,
  partner_id TEXT REFERENCES partners(id),
  role TEXT NOT NULL CHECK(role IN ('admin','partner')),
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS ops_sessions (
  token_hash TEXT PRIMARY KEY,
  access_key_id TEXT NOT NULL REFERENCES ops_access_keys(id) ON DELETE CASCADE,
  partner_id TEXT REFERENCES partners(id),
  role TEXT NOT NULL CHECK(role IN ('admin','partner')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ops_sessions_expiry ON ops_sessions(expires_at);

CREATE TABLE IF NOT EXISTS lead_events (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('customer','admin','partner','system')),
  actor_ref TEXT,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS lead_events_lead ON lead_events(lead_id,created_at DESC);

CREATE TABLE IF NOT EXISTS quality_events (
  id TEXT PRIMARY KEY,
  outcome TEXT NOT NULL,
  intent TEXT NOT NULL,
  selected_count INTEGER NOT NULL DEFAULT 0,
  feedback_reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS quality_events_created ON quality_events(created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);
