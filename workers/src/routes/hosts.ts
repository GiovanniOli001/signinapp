// ============================================
// HOSTS ROUTES
// ============================================

import { Env, json, error, uuid, parseBody } from '../index';

interface CreateHostBody {
  name: string;
}

export async function handleHosts(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const method = request.method;

  // GET /api/hosts - Get all hosts
  if (path === '/api/hosts' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT id, name
      FROM hosts
      WHERE deleted_at IS NULL
      ORDER BY name ASC
    `).all();

    return json({ hosts: result.results });
  }

  // POST /api/hosts - Create a host
  if (path === '/api/hosts' && method === 'POST') {
    const body = await parseBody<CreateHostBody>(request);

    if (!body.name || !body.name.trim()) {
      return error('Host name is required');
    }

    const id = uuid();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO hosts (id, name, created_at)
      VALUES (?, ?, ?)
    `).bind(id, body.name.trim(), now).run();

    return json({ id, name: body.name.trim(), message: 'Host created' }, 201);
  }

  // DELETE /api/hosts/:id - Delete a host
  const deleteMatch = path.match(/^\/api\/hosts\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const hostId = deleteMatch[1];
    const now = new Date().toISOString();

    const result = await env.DB.prepare(`
      UPDATE hosts SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL
    `).bind(now, hostId).run();

    if (result.meta.changes === 0) {
      return error('Host not found', 404);
    }

    return json({ message: 'Host deleted' });
  }

  return error('Not found', 404);
}
