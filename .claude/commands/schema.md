---
allowed-tools: Bash(npx:*), Read
argument-hint: [table_name]
description: Check database schema for a table
---

# Check Database Schema

Verify the actual database schema for a specific table.

## If table name provided ($ARGUMENTS):
```bash
cd workers && npx wrangler d1 execute signin-db --remote --command="PRAGMA table_info($ARGUMENTS);"
```

## If no table name:
List all tables:
```bash
cd workers && npx wrangler d1 execute signin-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## Important
- Always verify schema before writing INSERT/UPDATE statements
- Report column names, types, and NOT NULL constraints clearly
