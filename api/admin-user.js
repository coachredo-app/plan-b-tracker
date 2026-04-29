export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;

async function verifyAdmin(token) {
  if (!token) return false;
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
  if (req.method !== 'DELETE') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405 });
  }

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!(await verifyAdmin(token))) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
  }

  // Supprimer le compte auth (cascade sur les données liées)
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });

  // Supprimer le profil explicitement (sécurité si pas de cascade)
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
    method: 'DELETE',
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
