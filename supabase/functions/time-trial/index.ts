import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = (Deno.env.get("NEARER_APP_URL") || "https://nearer-iota.vercel.app").replace(/\/$/, "");
const DURATION_MS = 180_000;
const SUBMISSION_GRACE_MS = 15_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

let catalogPromise: Promise<{ version: string; codes: string[] }> | null = null;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
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

async function countryCatalog() {
  catalogPromise ||= fetch(`${APP_URL}/country-catalog.json`, { headers: { Accept: "application/json" } })
    .then(async result => {
      if (!result.ok) throw new Error(`Country catalog returned ${result.status}.`);
      const catalog = await result.json();
      const codes = (catalog.countries || []).map((country: { code?: string }) => country.code).filter((code: unknown) => typeof code === "string");
      if (!/^countries-[a-f0-9]{16}$/.test(catalog.version || "") || codes.length !== 197) {
        throw new Error("Country catalog is invalid.");
      }
      return { version: catalog.version, codes };
    });
  return catalogPromise;
}

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return data.user;
}

async function leaderboard(service: ReturnType<typeof createClient>, day: string) {
  const { data, error } = await service.rpc("get_time_trial_leaderboard", {
    p_daily_key: day,
    p_limit: 100
  });
  if (error) throw error;
  return data || [];
}

async function startRun(service: ReturnType<typeof createClient>, userId: string) {
  const day = dateKey();
  const { data: completed } = await service
    .from("game_results")
    .select("id")
    .eq("user_id", userId)
    .eq("mode", "time_trial")
    .eq("daily_key", day)
    .maybeSingle();
  if (completed) return response({ error: "Today's ranked attempt is already complete." }, 409);

  const { data: existing, error: existingError } = await service
    .from("time_trial_runs")
    .select("id,daily_key,sequence_version,started_at,expires_at,submitted_at")
    .eq("user_id", userId)
    .eq("daily_key", day)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (existing.submitted_at) return response({ error: "Today's ranked attempt is already complete." }, 409);
    if (Date.now() > Date.parse(existing.expires_at) + SUBMISSION_GRACE_MS) {
      return response({ error: "Today's ranked attempt has expired." }, 409);
    }
    return response({
      runId: existing.id,
      dateKey: existing.daily_key,
      sequenceVersion: existing.sequence_version,
      startedAt: existing.started_at,
      endsAt: existing.expires_at,
      resumed: true
    });
  }

  const catalog = await countryCatalog();
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + DURATION_MS);
  const sequence = dailySequence(catalog.codes, day);
  const { data, error } = await service
    .from("time_trial_runs")
    .insert({
      user_id: userId,
      daily_key: day,
      sequence_version: catalog.version,
      sequence_codes: sequence,
      started_at: startedAt.toISOString(),
      expires_at: endsAt.toISOString()
    })
    .select("id,daily_key,sequence_version,started_at,expires_at")
    .single();
  if (error) throw error;
  return response({
    runId: data.id,
    dateKey: data.daily_key,
    sequenceVersion: data.sequence_version,
    startedAt: data.started_at,
    endsAt: data.expires_at,
    resumed: false
  });
}

function validateResult(result: Record<string, unknown>, sequence: string[]) {
  const solved = Array.isArray(result.solved) ? result.solved : [];
  const found = Number(result.found);
  const guesses = Number(result.guesses);
  if (!Number.isInteger(found) || found < 0 || found > sequence.length || found !== solved.length) {
    throw new Error("The submitted country count is invalid.");
  }
  if (!Number.isInteger(guesses) || guesses < 0 || guesses > 1000) {
    throw new Error("The submitted guess count is invalid.");
  }

  let solvedGuesses = 0;
  const cleaned = solved.map((entry: unknown, index: number) => {
    const item = entry as Record<string, unknown>;
    const code = String(item.code || "");
    const count = Number(item.guesses);
    if (code !== sequence[index] || !Number.isInteger(count) || count < 1 || count > 200) {
      throw new Error("The submitted country sequence is invalid.");
    }
    solvedGuesses += count;
    return { code, guesses: count, durationMs: Math.max(0, Math.min(DURATION_MS, Number(item.durationMs || 0))) };
  });
  if (guesses < solvedGuesses) throw new Error("The submitted guess total is invalid.");

  const clientRunId = String(result.clientRunId || "");
  if (!clientRunId || clientRunId.length > 128) throw new Error("The result identifier is invalid.");
  return { clientRunId, found, guesses, solved: cleaned };
}

async function submitRun(service: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const runId = String(body.runId || "");
  const result = (body.result || {}) as Record<string, unknown>;
  const { data: run, error } = await service
    .from("time_trial_runs")
    .select("id,daily_key,sequence_version,sequence_codes,started_at,expires_at,submitted_at")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!run) return response({ error: "This ranked attempt could not be found." }, 404);
  if (run.submitted_at) return response({ error: "This ranked attempt was already submitted." }, 409);
  if (Date.now() > Date.parse(run.expires_at) + SUBMISSION_GRACE_MS) {
    return response({ error: "The ranked submission window has closed." }, 409);
  }

  const verified = validateResult(result, run.sequence_codes || []);
  const completedAt = new Date();
  const durationMs = Math.max(0, Math.min(DURATION_MS, completedAt.getTime() - Date.parse(run.started_at)));
  const timeRemainingMs = Math.max(0, DURATION_MS - durationMs);
  const { error: resultError } = await service.from("game_results").insert({
    user_id: userId,
    client_run_id: verified.clientRunId,
    mode: "time_trial",
    daily_key: run.daily_key,
    solved: verified.found > 0,
    guess_count: verified.guesses,
    duration_ms: durationMs,
    score: verified.found,
    completed_at: completedAt.toISOString(),
    payload: {
      verified: true,
      sequenceVersion: run.sequence_version,
      timeRemainingMs,
      solved: verified.solved
    }
  });
  if (resultError) throw resultError;

  const { error: updateError } = await service
    .from("time_trial_runs")
    .update({ submitted_at: completedAt.toISOString() })
    .eq("id", run.id)
    .eq("user_id", userId);
  if (updateError) throw updateError;

  return response({
    verified: true,
    dateKey: run.daily_key,
    countriesFound: verified.found,
    guessCount: verified.guesses,
    durationMs,
    timeRemainingMs,
    leaderboard: await leaderboard(service, run.daily_key)
  });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed." }, 405);

  try {
    const user = await authenticatedUser(req);
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const body = await req.json().catch(() => ({}));
    if (body.action === "start") return await startRun(service, user.id);
    if (body.action === "submit") return await submitRun(service, user.id, body);
    if (body.action === "leaderboard") return response({ leaderboard: await leaderboard(service, String(body.dateKey || dateKey())) });
    return response({ error: "Unknown action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected failure.";
    if (message === "AUTH_REQUIRED") return response({ error: "Sign in to enter the ranked Time Trial." }, 401);
    console.error("time-trial", error);
    return response({ error: message }, 500);
  }
});
