import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_URL = (Deno.env.get("NEARER_APP_URL") || "https://nearer-iota.vercel.app").replace(/\/$/, "");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
let catalogPromise: Promise<{ version: string; codes: string[] }> | null = null;

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function random(seed: number) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function dailySequence(codes: string[], day: string) {
  const output = [...codes];
  const next = random(hash(`nearer-time-trial:${day}:v1`));
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

async function catalog() {
  catalogPromise ||= fetch(`${APP_URL}/country-catalog.json`)
    .then(async response => {
      if (!response.ok) throw new Error(`Country catalog returned ${response.status}.`);
      const value = await response.json();
      const codes = (value.countries || []).map((country: { code: string }) => country.code);
      if (!/^countries-[a-f0-9]{16}$/.test(value.version || "") || codes.length !== 197) {
        throw new Error("Country catalog is invalid.");
      }
      return { version: value.version, codes };
    });
  return catalogPromise;
}

function client(req: Request) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function table(supabase: ReturnType<typeof createClient>, day: string) {
  const { data, error } = await supabase.rpc("get_time_trial_leaderboard", {
    p_daily_key: day,
    p_limit: 100
  });
  if (error) throw error;
  return data || [];
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = client(req);
    if (body.action === "start") {
      const day = dateKey();
      const countryCatalog = await catalog();
      const { data, error } = await supabase.rpc("start_time_trial_run", {
        p_daily_key: day,
        p_sequence_version: countryCatalog.version,
        p_sequence_codes: dailySequence(countryCatalog.codes, day)
      });
      if (error) throw error;
      const run = data?.[0];
      return reply({
        runId: run.run_id,
        dateKey: run.daily_key,
        sequenceVersion: run.sequence_version,
        startedAt: run.started_at,
        endsAt: run.ends_at,
        resumed: run.resumed
      });
    }
    if (body.action === "submit") {
      const result = body.result || {};
      const { data, error } = await supabase.rpc("submit_time_trial_run", {
        p_run_id: body.runId,
        p_client_run_id: result.clientRunId,
        p_found: result.found,
        p_guesses: result.guesses,
        p_solved: result.solved || []
      });
      if (error) throw error;
      return reply({ ...data, leaderboard: await table(supabase, data.dateKey) });
    }
    if (body.action === "leaderboard") {
      return reply({ leaderboard: await table(supabase, String(body.dateKey || dateKey())) });
    }
    return reply({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("time-trial", error);
    const message = error instanceof Error ? error.message : "Unexpected failure.";
    return reply({ error: message }, /AUTH_REQUIRED|JWT/i.test(message) ? 401 : 400);
  }
});
