export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;

async function getUserId(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id || null;
}

export default async function handler(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_token' }), { status: 401 });
  }

  const userId = await getUserId(token);
  if (!userId) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401 });
  }

  // GET — charger la progression
  if (req.method === 'GET') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_progress?id=eq.${userId}&limit=1`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json'
      }
    });
    const data = await res.json();
    const progress = Array.isArray(data) && data.length > 0 ? data[0].progress : null;
    return new Response(JSON.stringify({ ok: true, progress }), { status: 200 });
  }

  // POST — sauvegarder la progression
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), { status: 400 });
    }

    const { progress } = body;
    if (!progress) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_progress' }), { status: 400 });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/user_progress`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ id: userId, progress, updated_at: new Date().toISOString() })
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405 });
}
