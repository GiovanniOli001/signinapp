// ============================================
// VISITORS ROUTES
// ============================================

import { Env, json, error, uuid, parseBody } from '../index';

interface SignInBody {
  firstName: string;
  lastName: string;
  phone?: string | null;
  purpose: string;  // 'participant', 'visitor', 'staff'
}

interface SignOutWithSurveyBody {
  sessionRating: string;  // 'good', 'average', 'poor'
  comfortRating: string;  // 'comfortable', 'okay', 'uncomfortable'
  feedback?: string;  // Optional feedback text
}

// ============================================
// EMAIL HELPER (MailChannels via Cloudflare)
// ============================================

async function sendComfortAlertEmail(
  env: Env,
  visitorName: string,
  signInTime: string,
  feedback: string | null,
  recipientEmail: string
): Promise<void> {
  const formattedDate = new Date(signInTime).toLocaleString('en-AU', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Australia/Brisbane'
  });

  const emailBody = `
A visitor has reported feeling uncomfortable during their visit to VitalHub.

Visitor: ${visitorName}
Date/Time: ${formattedDate}
${feedback ? `\nAdditional Feedback:\n${feedback}` : ''}

This is an automated notification from the VitalHub Sign-In System.
  `.trim();

  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: recipientEmail }],
          },
        ],
        from: {
          email: 'noreply@signin-api.oliveri-john001.workers.dev',
          name: 'VitalHub Sign-In',
        },
        subject: 'VitalHub Sign-In: Comfort Alert',
        content: [
          {
            type: 'text/plain',
            value: emailBody,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Failed to send email:', await response.text());
    }
  } catch (err) {
    console.error('Email send error:', err);
  }
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

    if (!body.firstName || !body.purpose) {
      return error('First name and purpose are required');
    }

    const id = uuid();
    const now = new Date().toISOString();
    const fullName = `${body.firstName.trim()} ${(body.lastName || '').trim()}`.trim();

    await env.DB.prepare(`
      INSERT INTO visitors (id, name, first_name, last_name, phone, host_name, purpose, signed_in_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      fullName,  // Keep 'name' for backwards compatibility
      body.firstName.trim(),
      (body.lastName || '').trim(),
      body.phone || null,
      body.purpose.trim(),  // Store purpose in host_name for backwards compat
      body.purpose.trim(),
      now
    ).run();

    return json({ id, message: 'Signed in successfully' }, 201);
  }

  // POST /api/visitors/:id/signout-with-survey - Sign out with survey (participants)
  const signoutSurveyMatch = path.match(/^\/api\/visitors\/([^/]+)\/signout-with-survey$/);
  if (signoutSurveyMatch && method === 'POST') {
    const visitorId = signoutSurveyMatch[1];
    const body = await parseBody<SignOutWithSurveyBody>(request);
    const now = new Date().toISOString();

    // Get visitor info first (for email)
    const visitor = await env.DB.prepare(`
      SELECT name, first_name, last_name, signed_in_at FROM visitors WHERE id = ?
    `).bind(visitorId).first<{ name: string; first_name: string; last_name: string; signed_in_at: string }>();

    if (!visitor) {
      return error('Visitor not found', 404);
    }

    // Update with survey data and sign out
    const result = await env.DB.prepare(`
      UPDATE visitors
      SET signed_out_at = ?,
          survey_session_rating = ?,
          survey_comfort_rating = ?,
          survey_feedback = ?
      WHERE id = ? AND signed_out_at IS NULL
    `).bind(
      now,
      body.sessionRating,
      body.comfortRating,
      body.feedback || null,
      visitorId
    ).run();

    if (result.meta.changes === 0) {
      return error('Visitor not found or already signed out', 404);
    }

    // If uncomfortable, send email notification
    if (body.comfortRating === 'uncomfortable') {
      // Get notification email from settings (default to info@vitalhub.org.au)
      const emailSetting = await env.DB.prepare(`
        SELECT value FROM settings WHERE key = 'notificationEmail'
      `).first<{ value: string }>();

      const recipientEmail = emailSetting?.value || 'info@vitalhub.org.au';
      const visitorName = `${visitor.first_name || ''} ${visitor.last_name || ''}`.trim() || visitor.name;

      await sendComfortAlertEmail(
        env,
        visitorName,
        visitor.signed_in_at,
        body.feedback || null,
        recipientEmail
      );
    }

    return json({ message: 'Signed out successfully with survey' });
  }

  // POST /api/visitors/:id/signout - Sign out a visitor (no survey)
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
      SELECT id, name, first_name as firstName, last_name as lastName,
             phone, host_name as hostName, purpose,
             signed_in_at as signedInAt
      FROM visitors
      WHERE signed_out_at IS NULL
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

  // GET /api/visitors/surveys - Get survey responses (admin)
  if (path === '/api/visitors/surveys' && method === 'GET') {
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const ratingFilter = url.searchParams.get('rating');

    let query = `
      SELECT id, name, first_name as firstName, last_name as lastName,
             purpose, signed_in_at as signedInAt, signed_out_at as signedOutAt,
             survey_session_rating as sessionRating,
             survey_comfort_rating as comfortRating,
             survey_feedback as feedback
      FROM visitors
      WHERE purpose = 'participant' AND survey_session_rating IS NOT NULL
    `;
    const params: string[] = [];

    if (fromDate && toDate) {
      query += ` AND DATE(signed_in_at) >= ? AND DATE(signed_in_at) <= ?`;
      params.push(fromDate, toDate);
    }

    if (ratingFilter && ratingFilter !== 'all') {
      query += ` AND survey_comfort_rating = ?`;
      params.push(ratingFilter);
    }

    query += ` ORDER BY signed_in_at DESC`;

    const result = await env.DB.prepare(query).bind(...params).all();

    return json({ surveys: result.results });
  }

  // GET /api/visitors?from=YYYY-MM-DD&to=YYYY-MM-DD - Get visitors by date range
  if (path === '/api/visitors' && method === 'GET') {
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    if (!fromDate || !toDate) {
      return error('Missing from or to date');
    }

    const result = await env.DB.prepare(`
      SELECT id, name, first_name as firstName, last_name as lastName,
             phone, host_name as hostName, purpose,
             signed_in_at as signedInAt, signed_out_at as signedOutAt,
             survey_session_rating as sessionRating,
             survey_comfort_rating as comfortRating,
             survey_feedback as feedback
      FROM visitors
      WHERE DATE(signed_in_at) >= ? AND DATE(signed_in_at) <= ?
      ORDER BY signed_in_at DESC
    `).bind(fromDate, toDate).all();

    return json({ visitors: result.results });
  }

  return error('Not found', 404);
}
