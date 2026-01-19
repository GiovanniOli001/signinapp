-- ============================================
-- SIGN IN APP - DATABASE SCHEMA
-- ============================================

-- Config table for app settings
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Visit reasons (dropdown options)
CREATE TABLE IF NOT EXISTS visit_reasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- Visitors log
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  reason_id TEXT NOT NULL,
  reason_name TEXT NOT NULL,
  signed_in_at TEXT NOT NULL,
  signed_out_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_visitors_signed_in ON visitors(signed_in_at);
CREATE INDEX IF NOT EXISTS idx_visitors_signed_out ON visitors(signed_out_at);
CREATE INDEX IF NOT EXISTS idx_visitors_date ON visitors(DATE(signed_in_at));

-- Insert default visit reasons
INSERT INTO visit_reasons (id, name, display_order) VALUES
  ('reason-1', 'Appointment', 1),
  ('reason-2', 'Walk-in', 2),
  ('reason-3', 'Follow-up', 3),
  ('reason-4', 'Consultation', 4),
  ('reason-5', 'Other', 99);
