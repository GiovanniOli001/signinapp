// ============================================
// VISIT REASONS ROUTES
// ============================================

import { Env, json, error, uuid, parseBody } from '../index';

interface ReasonBody {
  name: string;
}

export async function handleReasons(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const method = request.method;

  // GET /api/reasons - Get all reasons
  if (path === '/api/reasons' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT id, name, display_order as displayOrder
      FROM visit_reasons
      WHERE deleted_at IS NULL
      ORDER BY display_order, name
    `).all();

    return json({ reasons: result.results });
  }

  // POST /api/reasons - Create a reason
  if (path === '/api/reasons' && method === 'POST') {
    const body = await parseBody<ReasonBody>(request);

    if (!body.name || !body.name.trim()) {
      return error('Name is required');
    }

    const id = uuid();
    const now = new Date().toISOString();

    // Get max display order
    const maxOrder = await env.DB.prepare(`
      SELECT COALESCE(MAX(display_order), 0) as maxOrder FROM visit_reasons
    `).first<{ maxOrder: number }>();

    await env.DB.prepare(`
      INSERT INTO visit_reasons (id, name, display_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, body.name.trim(), (maxOrder?.maxOrder || 0) + 1, now, now).run();

    return json({ id, name: body.name.trim() }, 201);
  }

  // DELETE /api/reasons/:id - Delete a reason
  const deleteMatch = path.match(/^\/api\/reasons\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const reasonId = deleteMatch[1];
    const now = new Date().toISOString();

    const result = await env.DB.prepare(`
      UPDATE visit_reasons SET deleted_at = ? WHERE id = ?
    `).bind(now, reasonId).run();

    if (result.meta.changes === 0) {
      return error('Reason not found', 404);
    }

    return json({ message: 'Reason deleted' });
  }

  return error('Not found', 404);
}
