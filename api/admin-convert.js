export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;

async function verifyAdmin(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return false;
  const user = await res.json();
  if (!user?.id) return false;
  const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&limit=1`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' }
  });
  const profs = await pRes.json();
  return Array.isArray(profs) && profs[0]?.is_admin === true;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false }), { status: 405 });
  }

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token || !(await verifyAdmin(token))) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), { status: 400 });
  }

  const { email, name, whatsapp, access_type, activated_at, expires_at } = body;
  if (!email) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_email' }), { status: 400 });
  }

  // Créer l'utilisateur Supabase via l'API admin (sans email de confirmation)
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { name: name || '', whatsapp: whatsapp || '' }
    })
  });

  const created = await createRes.json();

  if (!createRes.ok) {
    const msg = created?.msg || created?.message || created?.error_description || 'create_failed';
    const isDuplicate = createRes.status === 422 || msg.toLowerCase().includes('already');
    return new Response(
      JSON.stringify({ ok: false, error: isDuplicate ? 'already_exists' : msg }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const userId = created.id;
  if (!userId) {
    return new Response(JSON.stringify({ ok: false, error: 'no_user_id' }), { status: 200 });
  }

  // Upsert du profil (insertion si absent, mise à jour si présent via trigger)
  const profileData = { id: userId };
  if (access_type)  profileData.access_type  = access_type;
  if (activated_at) profileData.activated_at = new Date(activated_at).toISOString();
  if (expires_at)   profileData.expires_at   = new Date(expires_at).toISOString();

  await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(profileData)
  });

  // Envoyer un email de réinitialisation de mot de passe pour que l'utilisateur puisse se connecter
  await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase().trim() })
  });

  return new Response(
    JSON.stringify({ ok: true, userId }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
