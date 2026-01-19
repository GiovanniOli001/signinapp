---
paths:
  - "workers/**/*.ts"
---

# Backend Development Rules

## Before Making Changes
1. Read the current file content first
2. Check workers/src/schema.sql for table structures
3. Verify column names match the schema exactly

## Database Operations

### Always Include
- Parameterized queries (never string concatenation)
- Soft deletes use `deleted_at IS NULL` in WHERE clauses

### Query Patterns
```typescript
// Good: Parameterized
const result = await env.DB.prepare(
  'SELECT * FROM visitors WHERE id = ?'
).bind(id).first();

// Bad: String concatenation (SQL injection risk!)
const result = await env.DB.prepare(
  `SELECT * FROM visitors WHERE id = '${id}'`
).first();
```

## Response Patterns

```typescript
// Success response
return json({ id, message: 'Success' });

// Error response
return error('Error message', 400);

// List response
return json({ visitors: results });
```

## Pre-Deploy Checklist
1. Run `npx tsc --noEmit`
2. Fix any type errors
3. Test endpoint manually if possible
4. Deploy with `npx wrangler deploy`
