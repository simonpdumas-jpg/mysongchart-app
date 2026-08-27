import { useMemo } from 'react';
import { useSession } from '@clerk/clerk-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Wires a Supabase client to Clerk's session token via the native Supabase
// integration (Clerk dashboard -> Configure -> Integrations -> Supabase):
// Clerk stamps session tokens with a "role": "authenticated" claim, and
// Supabase verifies them directly against Clerk's JWKS - no shared secret,
// no per-request token fetch/template. RLS policies check
// auth.jwt() ->> 'sub' rather than auth.uid(), since Clerk user ids
// ("user_2abc...") aren't UUIDs.
// Returns null when the env vars aren't configured for this deployment
// (e.g. Production scope not added yet), rather than throwing and taking
// the whole app down - the charts feature degrades to unavailable instead.
export function useSupabaseClient() {
  const { session } = useSession();

  return useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: () => session?.getToken() ?? null,
    });
  }, [session]);
}

export async function listCharts(supabase, userId) {
  const { data, error } = await supabase
    .from('charts')
    .select('id, title, artist, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function loadChart(supabase, chartId) {
  const { data, error } = await supabase
    .from('charts')
    .select('id, chart_data')
    .eq('id', chartId)
    .single();

  if (error) throw error;
  return data;
}

// Inserts a new chart when chartId is null, otherwise updates the existing
// row in place. Returns the row's id, so a fresh insert can be tracked as
// "the currently loaded chart" for subsequent saves.
export async function saveChart(supabase, userId, { chartId, title, artist, chartData }) {
  if (chartId) {
    const { error } = await supabase
      .from('charts')
      .update({ title, artist, chart_data: chartData })
      .eq('id', chartId)
      .eq('user_id', userId);

    if (error) throw error;
    return chartId;
  }

  const { data, error } = await supabase
    .from('charts')
    .insert({ user_id: userId, title, artist, chart_data: chartData })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function deleteChart(supabase, chartId) {
  const { error } = await supabase.from('charts').delete().eq('id', chartId);
  if (error) throw error;
}
