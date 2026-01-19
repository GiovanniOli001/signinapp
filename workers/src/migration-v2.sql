-- ============================================
-- MIGRATION TO VERSION 2.0
-- VitalHub Ipswich Visitor Kiosk
-- ============================================

-- Drop old tables (clean slate for new schema)
DROP TABLE IF EXISTS visit_reasons;
DROP TABLE IF EXISTS visitors;
DROP TABLE IF EXISTS config;

-- Create new settings table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create hosts table
CREATE TABLE IF NOT EXISTS hosts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- Create new visitors table with simplified schema
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  host_name TEXT NOT NULL,
  signed_in_at TEXT NOT NULL,
  signed_out_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_visitors_signed_in ON visitors(signed_in_at);
CREATE INDEX IF NOT EXISTS idx_visitors_signed_out ON visitors(signed_out_at);
CREATE INDEX IF NOT EXISTS idx_visitors_date ON visitors(DATE(signed_in_at));
CREATE INDEX IF NOT EXISTS idx_hosts_name ON hosts(name);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
