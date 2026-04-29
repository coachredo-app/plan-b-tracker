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
  // ── POST public — soumission quiz
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ ok: false }), { status: 400 });
    }
    const { prenom, whatsapp, situation, objectif, budget } = body;
    await fetch(`${SUPABASE_URL}/rest/v1/quiz_leads`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ prenom, whatsapp, situation, objectif, budget, source: 'quiz' })
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // ── DELETE admin — suppression d'un lead
  if (req.method === 'DELETE') {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!(await verifyAdmin(token))) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
    }
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
    await fetch(`${SUPABASE_URL}/rest/v1/quiz_leads?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ ok: false }), { status: 405 });
}
