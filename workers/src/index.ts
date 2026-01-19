// ============================================
// SIGN IN APP - API
// VitalHub Ipswich Visitor Kiosk
// ============================================

import { handleVisitors } from './routes/visitors';
import { handleHosts } from './routes/hosts';
import { handleSettings } from './routes/settings';
import { handleAuth } from './routes/auth';

export interface Env {
  DB: D1Database;
  ADMIN_PASSWORD_HASH: string;
  JWT_SECRET: string;
}

// ============================================
// HELPERS
// ============================================

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function uuid(): string {
  return crypto.randomUUID();
}

export async function parseBody<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

// Simple JWT helpers (no external deps)
export function createToken(payload: object, secret: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 86400000 })); // 24h expiry
  const signature = btoa(secret + header + body); // Simplified - use proper HMAC in production
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string, secret: string): object | null {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSig = btoa(secret + header + body);
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

// ============================================
// CORS
// ============================================

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// ============================================
// ROUTER
// ============================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response: Response;

      // Route to handlers
      if (path.startsWith('/api/visitors')) {
        response = await handleVisitors(request, env, path);
      } else if (path.startsWith('/api/hosts')) {
        response = await handleHosts(request, env, path);
      } else if (path.startsWith('/api/settings')) {
        response = await handleSettings(request, env, path);
      } else if (path.startsWith('/api/auth')) {
        response = await handleAuth(request, env, path);
      } else {
        response = json({ message: 'Sign In API - VitalHub Ipswich', version: '2.0.0' });
      }

      return addCorsHeaders(response);

    } catch (err) {
      console.error('API Error:', err);
      return addCorsHeaders(error('Internal server error', 500));
    }
  }
};
