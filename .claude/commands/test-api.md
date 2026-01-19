---
allowed-tools: Bash(curl:*)
argument-hint: [endpoint]
description: Test an API endpoint
---

# Test API Endpoint

Test an API endpoint on the live server.

## API Base
https://signin-api.oliveri-john001.workers.dev/api

## Test Endpoint
```bash
curl -s "https://signin-api.oliveri-john001.workers.dev/api/$ARGUMENTS" | jq .
```

## Common Endpoints
- `reasons` - List visit reasons
- `visitors/signed-in` - Currently signed in visitors
- `visitors/stats/today` - Today's statistics
- `auth/verify` - Verify auth token (requires header)
