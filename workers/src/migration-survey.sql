-- ============================================
-- SIGN IN APP - SURVEY FEATURE MIGRATION
-- VitalHub Child Safety Compliance
-- ============================================

-- Add new columns to visitors table for split name and survey data
ALTER TABLE visitors ADD COLUMN first_name TEXT;
ALTER TABLE visitors ADD COLUMN last_name TEXT;
ALTER TABLE visitors ADD COLUMN purpose TEXT;  -- 'participant', 'visitor', 'staff'
ALTER TABLE visitors ADD COLUMN survey_session_rating TEXT;  -- 'good', 'average', 'poor'
ALTER TABLE visitors ADD COLUMN survey_comfort_rating TEXT;  -- 'comfortable', 'okay', 'uncomfortable'
ALTER TABLE visitors ADD COLUMN survey_feedback TEXT;  -- Optional feedback when uncomfortable

-- Migrate existing data: split 'name' into first_name and last_name
-- This takes the first word as first_name and the rest as last_name
UPDATE visitors
SET first_name = CASE
    WHEN INSTR(name, ' ') > 0 THEN SUBSTR(name, 1, INSTR(name, ' ') - 1)
    ELSE name
  END,
  last_name = CASE
    WHEN INSTR(name, ' ') > 0 THEN SUBSTR(name, INSTR(name, ' ') + 1)
    ELSE ''
  END
WHERE first_name IS NULL;

-- Migrate host_name to purpose - existing entries become 'visitor' (default)
UPDATE visitors SET purpose = 'visitor' WHERE purpose IS NULL;

-- Index for filtering by purpose and survey responses
CREATE INDEX IF NOT EXISTS idx_visitors_purpose ON visitors(purpose);
CREATE INDEX IF NOT EXISTS idx_visitors_survey ON visitors(survey_comfort_rating);
