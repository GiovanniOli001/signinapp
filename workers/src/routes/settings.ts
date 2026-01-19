// ============================================
// SETTINGS ROUTES
// ============================================

import { Env, json, error, uuid, parseBody } from '../index';

interface SaveSettingsBody {
  logoUrl?: string;
  backgroundUrl?: string;
}

export async function handleSettings(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const method = request.method;

  // GET /api/settings - Get settings
  if (path === '/api/settings' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT key, value FROM settings
    `).all();

    // Convert rows to object
    const settings: Record<string, string> = {};
    for (const row of result.results as { key: string; value: string }[]) {
      settings[row.key] = row.value;
    }

    return json({ settings });
  }

  // POST /api/settings - Save settings
  if (path === '/api/settings' && method === 'POST') {
    const body = await parseBody<SaveSettingsBody>(request);
    const now = new Date().toISOString();

    // Upsert each setting
    if (body.logoUrl !== undefined) {
      await env.DB.prepare(`
        INSERT INTO settings (id, key, value, updated_at)
        VALUES (?, 'logoUrl', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
      `).bind(uuid(), body.logoUrl, now, body.logoUrl, now).run();
    }

    if (body.backgroundUrl !== undefined) {
      await env.DB.prepare(`
        INSERT INTO settings (id, key, value, updated_at)
        VALUES (?, 'backgroundUrl', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
      `).bind(uuid(), body.backgroundUrl, now, body.backgroundUrl, now).run();
    }

    return json({ message: 'Settings saved' });
  }

  return error('Not found', 404);
}
