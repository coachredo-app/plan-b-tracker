export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_params' }), { status: 400 });
  }

  // 1. Authentifier l'utilisateur
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const authData = await authRes.json();

  if (!authRes.ok || authData.error) {
    return new Response(
      JSON.stringify({ ok: false, error: authData.error_description || authData.error || 'auth_failed' }),
      { status: 200 }
    );
  }

  const userId = authData.user?.id;

  // 2. Récupérer le profil côté serveur (rapide, pas de latence client)
  let profile = null;
  if (userId) {
    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&limit=1`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json'
      }
    });
    const profData = await profRes.json();
    profile = Array.isArray(profData) && profData.length > 0 ? profData[0] : null;
  }

  return new Response(
    JSON.stringify({ ok: true, session: authData, profile }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
