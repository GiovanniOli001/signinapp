// ============================================
// AUTH ROUTES
// ============================================

import { Env, json, error, parseBody, createToken, verifyToken } from '../index';

interface LoginBody {
  password: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

// Simple password hashing (for demo - use proper bcrypt in production)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'signin-app-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export async function handleAuth(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const method = request.method;

  // POST /api/auth/login - Admin login
  if (path === '/api/auth/login' && method === 'POST') {
    const body = await parseBody<LoginBody>(request);

    if (!body.password) {
      return error('Password is required');
    }

    // Get stored password hash from DB
    const config = await env.DB.prepare(`
      SELECT value FROM config WHERE key = 'admin_password_hash'
    `).first<{ value: string }>();

    if (!config) {
      // First time - set default password "admin"
      const defaultHash = await hashPassword('admin');
      await env.DB.prepare(`
        INSERT INTO config (key, value) VALUES ('admin_password_hash', ?)
      `).bind(defaultHash).run();

      if (body.password === 'admin') {
        const token = createToken({ role: 'admin' }, env.JWT_SECRET || 'default-secret');
        return json({ token, message: 'Login successful. Please change the default password.' });
      }
    }

    const storedHash = config?.value || await hashPassword('admin');
    const isValid = await verifyPassword(body.password, storedHash);

    if (!isValid) {
      return error('Invalid password', 401);
    }

    const token = createToken({ role: 'admin' }, env.JWT_SECRET || 'default-secret');
    return json({ token });
  }

  // POST /api/auth/change-password - Change admin password
  if (path === '/api/auth/change-password' && method === 'POST') {
    // Verify auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return error('Unauthorized', 401);
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token, env.JWT_SECRET || 'default-secret');
    if (!payload) {
      return error('Invalid token', 401);
    }

    const body = await parseBody<ChangePasswordBody>(request);

    if (!body.currentPassword || !body.newPassword) {
      return error('Current and new password required');
    }

    if (body.newPassword.length < 4) {
      return error('Password must be at least 4 characters');
    }

    // Verify current password
    const config = await env.DB.prepare(`
      SELECT value FROM config WHERE key = 'admin_password_hash'
    `).first<{ value: string }>();

    const storedHash = config?.value || await hashPassword('admin');
    const isValid = await verifyPassword(body.currentPassword, storedHash);

    if (!isValid) {
      return error('Current password is incorrect', 401);
    }

    // Update password
    const newHash = await hashPassword(body.newPassword);
    await env.DB.prepare(`
      INSERT OR REPLACE INTO config (key, value) VALUES ('admin_password_hash', ?)
    `).bind(newHash).run();

    return json({ message: 'Password changed successfully' });
  }

  // GET /api/auth/verify - Verify token is valid
  if (path === '/api/auth/verify' && method === 'GET') {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return error('Unauthorized', 401);
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token, env.JWT_SECRET || 'default-secret');

    if (!payload) {
      return error('Invalid token', 401);
    }

    return json({ valid: true });
  }

  return error('Not found', 404);
}
