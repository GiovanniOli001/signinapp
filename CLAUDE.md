# Sign In App - Claude Code Configuration

Simple visitor sign-in kiosk PWA for customer check-in/check-out with admin reporting.

## Project Overview

- **Frontend:** Vanilla JS PWA → Cloudflare Pages
- **Backend:** TypeScript → Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)

## Project Structure

```
signinapp/
├── frontend/
│   ├── index.html          # Main HTML (kiosk + admin)
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker
│   ├── css/main.css        # All styles
│   └── js/
│       ├── api.js          # API client
│       └── app.js          # Main application
├── workers/
│   ├── wrangler.toml       # Cloudflare config
│   └── src/
│       ├── index.ts        # Main router
│       ├── schema.sql      # Database schema
│       └── routes/
│           ├── visitors.ts
│           ├── reasons.ts
│           └── auth.ts
└── README.md
```

## Build & Deploy Commands

### Backend (Cloudflare Workers)
```bash
cd workers
npx tsc --noEmit          # Type check
npx wrangler deploy       # Deploy to production
npx wrangler tail         # Monitor logs
```

### Frontend (Cloudflare Pages)
```bash
git add .
git commit -m "your message"
git push                  # Auto-deploys
```

### Database
```bash
# Run schema
npx wrangler d1 execute signin-db --remote --file=src/schema.sql

# Check table
npx wrangler d1 execute signin-db --remote --command="PRAGMA table_info(visitors);"
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/visitors/signin` | Sign in a visitor |
| POST | `/api/visitors/:id/signout` | Sign out a visitor |
| GET | `/api/visitors/signed-in` | Get currently signed in |
| GET | `/api/visitors/stats/today` | Get today's statistics |
| GET | `/api/visitors?from=&to=` | Get visitors by date range |
| GET | `/api/reasons` | List visit reasons |
| POST | `/api/reasons` | Create visit reason |
| DELETE | `/api/reasons/:id` | Delete visit reason |
| POST | `/api/auth/login` | Admin login |
| POST | `/api/auth/change-password` | Change password |

## Database Schema

### visitors
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| first_name | TEXT | Visitor first name |
| last_name | TEXT | Visitor last name |
| reason_id | TEXT | FK to visit_reasons |
| reason_name | TEXT | Denormalized reason name |
| signed_in_at | TEXT | ISO timestamp |
| signed_out_at | TEXT | ISO timestamp (null if still in) |

### visit_reasons
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| name | TEXT | Display name |
| display_order | INTEGER | Sort order |
| deleted_at | TEXT | Soft delete |

### config
| Column | Type | Description |
|--------|------|-------------|
| key | TEXT | Config key |
| value | TEXT | Config value |

## Code Style

- Use 2-space indentation
- Prefer async/await
- Use `escapeHtml()` for user content
- Use `showToast(message, isError)` for notifications
