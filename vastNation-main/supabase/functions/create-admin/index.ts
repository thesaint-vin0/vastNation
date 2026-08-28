import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Supabase server configuration is incomplete.' }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authorization.replace(/^Bearer\s+/i, '');

    const { data: callerData, error: callerError } =
      await adminClient.auth.getUser(token);

    if (callerError || !callerData.user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { data: callerProfile, error: profileLookupError } =
      await adminClient
        .from('profiles')
        .select('role')
        .eq('id', callerData.user.id)
        .maybeSingle();

    if (profileLookupError) {
      return json({ error: profileLookupError.message }, 500);
    }

    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Admin access required' }, 403);
    }

    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const fullName = String(body.full_name ?? '').trim();

    if (!fullName || !email || !password) {
      return json({ error: 'Name, email and password are required.' }, 400);
    }

    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters.' }, 400);
    }

    const { data, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createError || !data.user) {
      return json(
        { error: createError?.message ?? 'Could not create admin account.' },
        400,
      );
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: data.user.id,
          email,
          full_name: fullName,
          role: 'admin',
        },
        { onConflict: 'id' },
      );

    if (profileError) {
      await adminClient.auth.admin.deleteUser(data.user.id);
      return json({ error: profileError.message }, 400);
    }

    return json({
      success: true,
      id: data.user.id,
      email,
    });
  } catch (error) {
    console.error('create-admin error:', error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create admin account.',
      },
      500,
    );
  }
});
