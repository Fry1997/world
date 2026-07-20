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

export async function createFriendChallenge() {
  const supabase = await client();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("Sign in before challenging a friend.");
  const { data, error } = await supabase.rpc("create_time_trial_challenge");
  if (error) throw error;
  const challenge = data?.[0];
  if (!challenge) throw new Error("Complete today's verified ranked run before sharing a challenge.");
  return challenge;
}

export async function loadFriendChallenge(challengeId) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("get_time_trial_challenge", {
    p_challenge_id: challengeId
  });
  if (error) throw error;
  return data?.[0] || null;
}
