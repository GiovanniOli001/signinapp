// ============================================
// VISITORS ROUTES
// ============================================

import { Env, json, error, uuid, parseBody } from '../index';

interface SignInBody {
  firstName: string;
  lastName: string;
  reasonId: string;
  reasonName: string;
}

export async function handleVisitors(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);

  // POST /api/visitors/signin - Sign in a visitor
  if (path === '/api/visitors/signin' && method === 'POST') {
    const body = await parseBody<SignInBody>(request);

    if (!body.firstName || !body.lastName || !body.reasonId) {
      return error('Missing required fields');
    }

    const id = uuid();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO visitors (id, first_name, last_name, reason_id, reason_name, signed_in_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, body.firstName, body.lastName, body.reasonId, body.reasonName, now).run();

    return json({ id, message: 'Signed in successfully' }, 201);
  }

  // POST /api/visitors/:id/signout - Sign out a visitor
  const signoutMatch = path.match(/^\/api\/visitors\/([^/]+)\/signout$/);
  if (signoutMatch && method === 'POST') {
    const visitorId = signoutMatch[1];
    const now = new Date().toISOString();

    const result = await env.DB.prepare(`
      UPDATE visitors SET signed_out_at = ? WHERE id = ? AND signed_out_at IS NULL
    `).bind(now, visitorId).run();

    if (result.meta.changes === 0) {
      return error('Visitor not found or already signed out', 404);
    }

    return json({ message: 'Signed out successfully' });
  }

  // GET /api/visitors/signed-in - Get currently signed in visitors
  if (path === '/api/visitors/signed-in' && method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT id, first_name as firstName, last_name as lastName,
             reason_id as reasonId, reason_name as reasonName,
             signed_in_at as signedInAt
      FROM visitors
      WHERE signed_out_at IS NULL
        AND DATE(signed_in_at) = DATE('now')
      ORDER BY signed_in_at DESC
    `).all();

    return json({ visitors: result.results });
  }

  // GET /api/visitors/stats/today - Get today's stats
  if (path === '/api/visitors/stats/today' && method === 'GET') {
    const signedInResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM visitors
      WHERE signed_out_at IS NULL AND DATE(signed_in_at) = DATE('now')
    `).first<{ count: number }>();

    const totalResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM visitors
      WHERE DATE(signed_in_at) = DATE('now')
    `).first<{ count: number }>();

    return json({
      signedIn: signedInResult?.count || 0,
      total: totalResult?.count || 0
    });
  }

  // GET /api/visitors?from=YYYY-MM-DD&to=YYYY-MM-DD - Get visitors by date range
  if (path === '/api/visitors' && method === 'GET') {
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    if (!fromDate || !toDate) {
      return error('Missing from or to date');
    }

    const result = await env.DB.prepare(`
      SELECT id, first_name as firstName, last_name as lastName,
             reason_id as reasonId, reason_name as reasonName,
             signed_in_at as signedInAt, signed_out_at as signedOutAt
      FROM visitors
      WHERE DATE(signed_in_at) >= ? AND DATE(signed_in_at) <= ?
      ORDER BY signed_in_at DESC
    `).bind(fromDate, toDate).all();

    return json({ visitors: result.results });
  }

  return error('Not found', 404);
}
