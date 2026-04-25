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

  const { email, password, name, whatsapp } = body;
  if (!email || !password) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_params' }), { status: 400 });
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, data: { name, whatsapp } })
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const msg = data.error || data.msg || 'signup_failed';
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 200 });
  }

  return new Response(
    JSON.stringify({ ok: true, session: data }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
