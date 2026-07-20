import cloudSource from "../cloud.js?raw";

const projectUrl = cloudSource.match(/const SUPABASE_URL = "([^"]+)"/)?.[1];
const publishableKey = cloudSource.match(/const SUPABASE_KEY = "([^"]+)"/)?.[1];
let clientPromise;

async function client() {
  if (!projectUrl || !publishableKey) throw new Error("Nearer account configuration is unavailable.");
  clientPromise ||= import("./supabase-client.js").then(({ createClient }) => createClient(projectUrl, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }));
  return clientPromise;
}

async function invoke(body) {
  const supabase = await client();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("Sign in to use the daily competition.");
  const { data, error } = await supabase.functions.invoke("time-trial", { body });
  if (error) {
    let message = error.message || "The daily competition service could not be reached.";
    try {
      const payload = await error.context?.json?.();
      if (payload?.error) message = payload.error;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function startCompetition(dateKey) {
  return invoke({ action: "start", dateKey });
}

export function submitCompetition(runId, result) {
  return invoke({ action: "submit", runId, result });
}

export function loadCompetitionTable(dateKey) {
  return invoke({ action: "leaderboard", dateKey }).then(data => data.leaderboard || []);
}
