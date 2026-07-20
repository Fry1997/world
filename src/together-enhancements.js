async function loadExperienceFourToSeven() {
  await import('../together/shared/experience4.js');
  if (!window.__NEARER_EXPERIENCE4_STARTED) throw new Error('The compact visual experience layer did not initialise.');

  await import('../together/shared/experience5.js');
  if (!window.__NEARER_EXPERIENCE5_STARTED) throw new Error('The width-normalised visual layer did not initialise.');

  await import('../together/shared/experience6.js');
  if (!window.__NEARER_EXPERIENCE6_STARTED) throw new Error('The elevated visual layer did not initialise.');

  await import('../together/shared/experience7.js');
  if (!window.__NEARER_EXPERIENCE7_STARTED) throw new Error('The final responsive visual layer did not initialise.');
}

async function loadExperienceEightToTen() {
  await import('../together/shared/experience8.js');
  if (!window.__NEARER_EXPERIENCE8_STARTED) throw new Error('The contrast refinement layer did not initialise.');

  await import('../together/shared/experience9.js');
  if (!window.__NEARER_EXPERIENCE9_STARTED) throw new Error('The globe overlay correction layer did not initialise.');

  await import('../together/shared/experience10.js');
  if (!window.__NEARER_EXPERIENCE10_STARTED) throw new Error('The final stabilisation layer did not initialise.');
}

async function loadPremiumGlobe() {
  await import('../together/shared/premium-globe-v2.js');
  if (!window.__NEARER_PREMIUM_GLOBE_V2_STARTED) {
    throw new Error('The adaptive globe renderer did not initialise.');
  }
}

export async function loadRaceEnhancements() {
  await import('../together/shared/polish-ui.js');
  await loadExperienceFourToSeven();
  await loadPremiumGlobe();
  await loadExperienceEightToTen();
}

export async function loadModeEnhancements({ duelPressure = false } = {}) {
  await loadPremiumGlobe();
  await import('../together/shared/polish-ui.js');
  if (duelPressure) await import('../together/duel/duel-pressure.js');
  await loadExperienceFourToSeven();
  await loadExperienceEightToTen();
}
