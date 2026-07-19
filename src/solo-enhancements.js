import "../together/shared/premium-globe-v2.js";
import "../guess-rules.js";
import "../together/shared/experience4.js";
import "../together/shared/experience5.js";
import "../together/shared/experience6.js";
import "../together/shared/experience7.js";
import "../guessed-country-info.js";
import "../together/shared/experience8.js";
import "../together/shared/experience9.js";
import "../together/shared/experience10.js";

if (!window.__NEARER_PREMIUM_GLOBE_V2_STARTED || !document.getElementById("globeCanvas")) {
  throw new Error("The adaptive globe renderer did not initialise.");
}
if (!document.querySelector("style[data-nearer-guess-rules]")) {
  throw new Error("The name-only guessing rules did not initialise.");
}
if (!window.__NEARER_EXPERIENCE4_STARTED) throw new Error("The compact visual experience layer did not initialise.");
if (!window.__NEARER_EXPERIENCE5_STARTED) throw new Error("The width-normalised visual layer did not initialise.");
if (!window.__NEARER_EXPERIENCE6_STARTED) throw new Error("The elevated visual layer did not initialise.");
if (!window.__NEARER_EXPERIENCE7_STARTED) throw new Error("The final responsive visual layer did not initialise.");
if (!window.__NEARER_GUESSED_COUNTRY_INFO_STARTED) throw new Error("Guessed-country identification did not initialise.");
if (!window.__NEARER_EXPERIENCE8_STARTED) throw new Error("The contrast refinement layer did not initialise.");
if (!window.__NEARER_EXPERIENCE9_STARTED) throw new Error("The globe overlay correction layer did not initialise.");
if (!window.__NEARER_EXPERIENCE10_STARTED) throw new Error("The final stabilisation layer did not initialise.");
