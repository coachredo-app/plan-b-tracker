export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_KEY    = 'PLANB-ADMIN-2026';

export default async function handler(req) {
  const key = req.headers.get('x-admin-key');
  if (key !== ADMIN_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  // Clients activés avec leurs profils
  const profilesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?access_type=neq.no_access&order=activated_at.desc`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' } }
  );
  const profiles = await profilesRes.json();

  // Tous les codes
  const codesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/access_codes?order=created_at.desc`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' } }
  );
  const codes = await codesRes.json();

  // Progression de chaque client
  const progressRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_progress`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' } }
  );
  const progressList = await progressRes.json();

  // Utilisateurs auth (pour email)
  const usersRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
  );
  const usersData = await usersRes.json();
  const users = usersData?.users || [];

  // Croiser les données
  const clients = (Array.isArray(profiles) ? profiles : []).map(p => {
    const user = users.find(u => u.id === p.id);
    const prog = (Array.isArray(progressList) ? progressList : []).find(pr => pr.id === p.id);
    const progress = prog?.progress || {};

    // Calcul progression %
    const phases = ['p1','p2','p3','p4'];
    let totalSteps = 0, completedSteps = 0;
    phases.forEach(ph => {
      if(progress[ph]) {
        const step = progress[ph].step || 0;
        totalSteps += 10;
        completedSteps += Math.min(step, 10);
      }
    });
    const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // Phase en cours
    let currentPhase = 'Pas commencé';
    if(progress.completed) currentPhase = '✅ Terminé';
    else if(progress.p4?.step > 0) currentPhase = 'Phase 4';
    else if(progress.p3?.step > 0) currentPhase = 'Phase 3';
    else if(progress.p2?.step > 0) currentPhase = 'Phase 2';
    else if(progress.p1?.step > 0) currentPhase = 'Phase 1';

    return {
      id: p.id,
      name: user?.user_metadata?.name || p.raw_user_meta_data?.name || '—',
      email: user?.email || '—',
      whatsapp: user?.user_metadata?.whatsapp || p.raw_user_meta_data?.whatsapp || '—',
      access_type: p.access_type,
      activated_at: p.activated_at,
      expires_at: p.expires_at,
      pct,
      currentPhase
    };
  });

  const codesArr = Array.isArray(codes) ? codes : [];
  const stats = {
    total_clients: clients.length,
    codes_used: codesArr.filter(c => c.used_by).length,
    codes_available: codesArr.filter(c => !c.used_by).length,
    fondateur: clients.filter(c => c.access_type === 'planb_founder_v1' || c.access_type === 'planb_fondateur').length,
    trente_jours: clients.filter(c => c.access_type === 'planb_30_days').length,
    expired: clients.filter(c => c.expires_at && new Date(c.expires_at) < new Date()).length
  };

  return new Response(
    JSON.stringify({ ok: true, stats, clients, codes: codesArr }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
