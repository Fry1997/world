const endpoint = "https://gxtrcjuhlgkpanqndtwy.supabase.co/functions/v1/time-trial";

async function invoke(body) {
  const token = window.NEARER_CLOUD?.session?.access_token;
  if (!token) throw new Error("Sign in to use the daily competition.");
  const result = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(data.error || "The daily competition service could not be reached.");
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
