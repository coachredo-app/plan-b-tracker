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
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token || !(await verifyAdmin(token))) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  const url = new URL(req.url);
  const hdrs = { 'Content-Type': 'application/json' };

  // ── GET — liste tous les leads WA
  if (req.method === 'GET') {
    const res  = await fetch(`${SUPABASE_URL}/rest/v1/wa_leads?order=created_at.desc`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' }
    });
    const data = await res.json();
    return new Response(JSON.stringify({ ok: true, leads: Array.isArray(data) ? data : [] }), { status: 200, headers: hdrs });
  }

  // ── POST — créer un lead
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return new Response(JSON.stringify({ ok: false }), { status: 400 }); }
    const { nom, whatsapp, source, statut, budget, notes } = body;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/wa_leads`, {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ nom: nom||'', whatsapp: whatsapp||'', source: source||'WhatsApp', statut: statut||'nouveau', budget: budget||'', notes: notes||'' })
    });
    const data = await res.json();
    return new Response(JSON.stringify({ ok: true, lead: Array.isArray(data) ? data[0] : data }), { status: 200, headers: hdrs });
  }

  // ── PATCH — modifier un lead
  if (req.method === 'PATCH') {
    const id = url.searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
    let body;
    try { body = await req.json(); } catch { return new Response(JSON.stringify({ ok: false }), { status: 400 }); }
    await fetch(`${SUPABASE_URL}/rest/v1/wa_leads?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(body)
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: hdrs });
  }

  // ── DELETE — supprimer un lead
  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
    await fetch(`${SUPABASE_URL}/rest/v1/wa_leads?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: hdrs });
  }

  return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405 });
}
