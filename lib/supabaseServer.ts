import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using service role for writes.
// Do NOT expose SERVICE_ROLE_KEY to the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseServer = url && key
  ? createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null as any;