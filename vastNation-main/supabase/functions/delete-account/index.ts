import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase server secrets are not configured.');
}

const admin = createClient(supabaseUrl, serviceRoleKey);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const token = authorization.slice('Bearer '.length);
    const { data: authData, error: authError } = await admin.auth.getUser(token);

    if (authError || !authData.user) return json({ error: 'Invalid session.' }, 401);

    const body = await req.json().catch(() => ({}));
    if (body.confirmation !== 'DELETE') {
      return json({ error: 'Type DELETE to confirm account deletion.' }, 400);
    }

    // Deleting auth.users cascades to profiles, addresses, orders and
    // related commerce records according to the existing schema.
    const { error } = await admin.auth.admin.deleteUser(authData.user.id);

    if (error) {
      console.error('Account deletion failed:', error);
      return json({ error: 'Could not delete your account.' }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    return json({ error: 'Internal server error.' }, 500);
  }
});
