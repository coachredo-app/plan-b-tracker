export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false }), { status: 405 });
  }

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
