import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async (req) => {
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: {'Content-Type':'application/json'} });
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = auth.replace(/^Bearer\s+/i, '');
    const { data, error } = await adminClient.auth.getUser(token);
    if (error || !data.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: {'Content-Type':'application/json'} });
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(data.user.id);
    if (deleteError) throw deleteError;
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: {'Content-Type':'application/json'} });
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to delete account' }), { status: 500, headers: {'Content-Type':'application/json'} }); }
});
