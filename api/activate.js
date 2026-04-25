export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), { status: 400 });
  }

  const { code, token } = body;
  if (!code || !token) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_params' }), { status: 400 });
  }

  // Vérifier le JWT et récupérer l'utilisateur
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 401 });
  }
  const user = await userRes.json();
  const userId = user.id;

  // Chercher le code disponible
  const codeRes = await fetch(
    `${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(code.trim().toUpperCase())}&used_by=is.null&limit=1`,
    {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json'
      }
    }
  );
  const codes = await codeRes.json();
  if (!codes || codes.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_code' }), { status: 200 });
  }

  const found = codes[0];
  const accessType = found.access_type;
  const expiresAt = accessType === 'planb_30_days'
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Marquer le code comme utilisé
  await fetch(`${SUPABASE_URL}/rest/v1/access_codes?id=eq.${found.id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ used_by: userId, used_at: new Date().toISOString() })
  });

  // Mettre à jour le profil
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ access_type: accessType, activated_at: new Date().toISOString(), expires_at: expiresAt })
  });

  return new Response(
    JSON.stringify({ ok: true, access_type: accessType, expires_at: expiresAt }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
