async function client() {
  const getClient = window.NEARER_CLOUD?.client;
  if (!getClient) throw new Error("Nearer account services are still loading.");
  return getClient();
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
