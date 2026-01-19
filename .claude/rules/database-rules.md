---
paths:
  - "workers/src/**/*.sql"
  - "workers/src/schema.sql"
---

# Database Rules

## Schema Changes

### Before Any Schema Change
1. Backup current data if needed
2. Test on local development first
3. Use ALTER TABLE for additive changes
4. Update schema.sql after changes

## Query Patterns

### Soft Deletes
The visit_reasons table uses soft deletes:
```sql
-- Mark as deleted
UPDATE visit_reasons SET deleted_at = datetime('now') WHERE id = ?

-- Query active records only
SELECT * FROM visit_reasons WHERE deleted_at IS NULL
```

### Visitors Table
Visitors don't use soft deletes - they have signed_in_at and signed_out_at:
```sql
-- Currently signed in (today)
SELECT * FROM visitors
WHERE signed_out_at IS NULL
  AND DATE(signed_in_at) = DATE('now')

-- Sign out a visitor
UPDATE visitors SET signed_out_at = datetime('now') WHERE id = ?
```

## Table Reference

### visitors
- id, first_name, last_name, reason_id, reason_name
- signed_in_at (NOT NULL), signed_out_at (NULL when signed in)

### visit_reasons
- id, name, display_order
- deleted_at (soft delete)

### config
- key, value (for admin password hash, etc.)
