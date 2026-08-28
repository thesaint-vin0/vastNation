import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async (req) => {
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: {'Content-Type':'application/json'} });
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = auth.replace(/^Bearer\s+/i, '');
    const { data: callerData } = await adminClient.auth.getUser(token);
    if (!callerData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: {'Content-Type':'application/json'} });
    const { data: callerProfile } = await adminClient.from('profiles').select('role').eq('id', callerData.user.id).single();
    if (callerProfile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: {'Content-Type':'application/json'} });
    const { email, password, full_name } = await req.json();
    if (!email || !password || password.length < 8 || !full_name) return new Response(JSON.stringify({ error: 'Name, email and an 8+ character password are required.' }), { status: 400, headers: {'Content-Type':'application/json'} });
    const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
    if (error || !data.user) throw error ?? new Error('Could not create user');
    const { error: profileError } = await adminClient.from('profiles').upsert({ id: data.user.id, email: data.user.email ?? email, full_name, role: 'admin' }, { onConflict: 'id' });
    if (profileError) { await adminClient.auth.admin.deleteUser(data.user.id); throw profileError; }
    return new Response(JSON.stringify({ id: data.user.id, email: data.user.email }), { status: 200, headers: {'Content-Type':'application/json'} });
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to create admin' }), { status: 500, headers: {'Content-Type':'application/json'} }); }
});
