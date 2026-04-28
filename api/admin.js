export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;

async function getAdminUser(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;

  // Vérifier is_admin dans profiles
  const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&limit=1`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' }
  });
  const profiles = await profRes.json();
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile?.is_admin) return null;
  return user;
}

export default async function handler(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_token' }), { status: 401 });
  }

  const adminUser = await getAdminUser(token);
  if (!adminUser) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  // Tous les profils
  const profilesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?order=activated_at.desc`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' } }
  );
  const profiles = await profilesRes.json();

  // Codes
  const codesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/access_codes?order=created_at.desc`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' } }
  );
  const codes = await codesRes.json();

  // Progression
  const progressRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_progress`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' } }
  );
  const progressList = await progressRes.json();

  // Utilisateurs auth
  const usersRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
  );
  const usersData = await usersRes.json();
  const users = usersData?.users || [];

  const allProfiles = (Array.isArray(profiles) ? profiles : []).filter(p => !p.is_admin);

  // Inscrits sans code activé
  const pending = allProfiles
    .filter(p => !p.access_type || p.access_type === 'no_access')
    .map(p => {
      const user = users.find(u => u.id === p.id);
      return {
        id: p.id,
        name: user?.user_metadata?.name || '—',
        email: user?.email || '—',
        whatsapp: user?.user_metadata?.whatsapp || '—',
        created_at: user?.created_at
      };
    });

  const clients = allProfiles
    .filter(p => p.access_type && p.access_type !== 'no_access')
    .map(p => {
      const user = users.find(u => u.id === p.id);
      const prog = (Array.isArray(progressList) ? progressList : []).find(pr => pr.id === p.id);
      const progress = prog?.progress || {};

      let completedSteps = 0, totalSteps = 40;
      ['p1','p2','p3','p4'].forEach(ph => {
        if(progress[ph]) completedSteps += Math.min(progress[ph].step || 0, 10);
      });
      const pct = Math.round((completedSteps / totalSteps) * 100);

      let currentPhase = 'Pas commencé';
      if(progress.completed) currentPhase = '✅ Terminé';
      else if(progress.p4?.step > 0) currentPhase = 'Phase 4';
      else if(progress.p3?.step > 0) currentPhase = 'Phase 3';
      else if(progress.p2?.step > 0) currentPhase = 'Phase 2';
      else if(progress.p1?.step > 0) currentPhase = 'Phase 1';

      return {
        id: p.id,
        name: user?.user_metadata?.name || '—',
        email: user?.email || '—',
        whatsapp: user?.user_metadata?.whatsapp || '—',
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
    pending: pending.length,
    codes_used: codesArr.filter(c => c.used_by).length,
    codes_available: codesArr.filter(c => !c.used_by).length,
    fondateur: clients.filter(c => c.access_type === 'planb_founder_v1' || c.access_type === 'planb_fondateur').length,
    trente_jours: clients.filter(c => c.access_type === 'planb_30_days').length,
    expired: clients.filter(c => c.expires_at && new Date(c.expires_at) < new Date()).length
  };

  return new Response(
    JSON.stringify({ ok: true, stats, clients, pending, codes: codesArr }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
