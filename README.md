# Sign In App

A simple visitor sign-in kiosk application. Customers sign in when they arrive, sign out when they leave. Includes an admin panel for reporting.

## Features

- **Kiosk Mode** - Touch-friendly interface for tablets/iPads
- **Sign In/Out** - Customers enter name and reason for visit
- **PWA Support** - Install as an app on any device
- **Admin Dashboard** - View today's visitors, generate reports, export CSV
- **Settings** - Manage visit reasons, change admin password

## Tech Stack

- **Frontend:** Vanilla JavaScript + CSS (PWA)
- **Backend:** TypeScript on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)

---

## Setup Instructions

### 1. Install Dependencies

```bash
cd C:\Users\Giovanni\Downloads\signinapp\workers
npm install
```

### 2. Create D1 Database

```bash
npx wrangler d1 create signin-db
```

This will output a database ID. Copy it.

### 3. Update wrangler.toml

Open `workers/wrangler.toml` and replace `YOUR_DATABASE_ID` with the ID from step 2:

```toml
[[d1_databases]]
binding = "DB"
database_name = "signin-db"
database_id = "abc123-your-actual-id-here"
```

### 4. Initialize Database Schema

```bash
npx wrangler d1 execute signin-db --remote --file=src/schema.sql
```

### 5. Set JWT Secret

```bash
npx wrangler secret put JWT_SECRET
```

Enter a random string when prompted (e.g., `mysecretkey123`).

### 6. Deploy Backend

```bash
npx tsc --noEmit
npx wrangler deploy
```

Note the deployed URL (e.g., `https://signin-api.your-subdomain.workers.dev`).

### 7. Update Frontend API URL

Open `frontend/js/api.js` and update `API_BASE`:

```javascript
const API_BASE = 'https://signin-api.your-subdomain.workers.dev';
```

### 8. Deploy Frontend

**Option A: Cloudflare Pages (recommended)**

1. Create a new GitHub repository
2. Push the `signinapp` folder to it
3. Go to [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages)
4. Create a new project, connect your GitHub repo
5. Set build settings:
   - Build command: (leave empty)
   - Build output: `frontend`

**Option B: Manual upload**

1. Go to [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages)
2. Create project → Upload assets
3. Upload the contents of the `frontend` folder

---

## Usage

### Kiosk Mode

1. Open the app URL on a tablet/iPad
2. Customers enter their name and select a reason
3. Tap "Sign In"
4. To sign out, tap the link at the bottom and select their name

### Admin Access

1. Triple-tap (or 5 rapid taps) on the top-right corner
2. Enter password (default: `admin`)
3. Access the dashboard

### Default Admin Password

The default password is `admin`. **Change it immediately** in Settings → Change Password.

---

## PWA Installation

### iOS (iPad/iPhone)

1. Open the app in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"

### Android

1. Open the app in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home Screen" or "Install app"

### Desktop

1. Open in Chrome/Edge
2. Click the install icon in the address bar

---

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
| GET | `/api/auth/verify` | Verify auth token |

---

## Project Structure

```
signinapp/
├── frontend/
│   ├── index.html          # Main HTML
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker
│   ├── css/
│   │   └── main.css        # All styles
│   ├── js/
│   │   ├── api.js          # API client
│   │   └── app.js          # Main application
│   └── icons/              # PWA icons (add your own)
│       ├── icon-192.png
│       └── icon-512.png
├── workers/
│   ├── package.json
│   ├── tsconfig.json
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

---

## Adding PWA Icons

Create two PNG icons and place them in `frontend/icons/`:

- `icon-192.png` - 192x192 pixels
- `icon-512.png` - 512x512 pixels

You can use any icon generator like [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator).

---

## Customization

### Change Colors

Edit the CSS variables in `frontend/css/main.css`:

```css
:root {
  --primary: #2563eb;        /* Main brand color */
  --primary-hover: #1d4ed8;  /* Hover state */
  --success: #16a34a;        /* Success messages */
  /* ... */
}
```

### Change Welcome Text

Edit `frontend/index.html`:

```html
<div class="kiosk-header">
  <h1>Welcome</h1>
  <p>Please sign in below</p>
</div>
```

---

## License

MIT
