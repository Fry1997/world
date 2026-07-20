import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { contentSecurityPolicy, inlineScriptHashes, securityHeaders } from "../security-headers.mjs";

const root = process.cwd();
const config = JSON.parse(await readFile(resolve(root, "vercel.json"), "utf8"));
const catchAll = config.headers?.find(rule => rule.source === "/(.*)");
if (!catchAll) throw new Error("vercel.json is missing its catch-all security header rule.");

const configured = Object.fromEntries((catchAll.headers || []).map(header => [header.key, header.value]));
for (const [key, expected] of Object.entries(securityHeaders)) {
  if (configured[key] !== expected) {
    throw new Error(`${key} does not match the canonical Nearer security header.`);
  }
}

const directives = new Map(contentSecurityPolicy.split("; ").map(directive => {
  const [name, ...values] = directive.split(" ");
  return [name, values];
}));

const requiredDirectives = [
  "default-src",
  "base-uri",
  "object-src",
  "frame-ancestors",
  "form-action",
  "script-src",
  "style-src",
  "img-src",
  "font-src",
  "connect-src",
  "worker-src",
  "manifest-src",
  "upgrade-insecure-requests"
];

for (const directive of requiredDirectives) {
  if (!directives.has(directive)) throw new Error(`Content Security Policy is missing ${directive}.`);
}

const policyFailures = [];
if (directives.get("script-src")?.includes("'unsafe-inline'")) policyFailures.push("arbitrary inline scripts are permitted");
if (contentSecurityPolicy.includes("'unsafe-eval'")) policyFailures.push("script evaluation is permitted");
if (contentSecurityPolicy.includes("*")) policyFailures.push("a wildcard source is permitted");
if (contentSecurityPolicy.includes("cdn.jsdelivr.net")) policyFailures.push("the former runtime CDN remains permitted");
if (!directives.get("connect-src")?.includes("https://gxtrcjuhlgkpanqndtwy.supabase.co")) {
  policyFailures.push("Supabase HTTPS requests are not permitted");
}
if (!directives.get("connect-src")?.includes("wss://gxtrcjuhlgkpanqndtwy.supabase.co")) {
  policyFailures.push("Supabase realtime connections are not permitted");
}
if (!directives.get("object-src")?.includes("'none'")) policyFailures.push("embedded objects are not disabled");

if (policyFailures.length) {
  throw new Error(`Nearer security policy is invalid:\n- ${policyFailures.join("\n- ")}`);
}

const configuredKeys = Object.keys(configured);
const expectedKeys = Object.keys(securityHeaders);
const missingOrExtra = configuredKeys.filter(key => !expectedKeys.includes(key))
  .concat(expectedKeys.filter(key => !configuredKeys.includes(key)));
if (missingOrExtra.length) {
  throw new Error(`The Vercel security header set has drifted: ${[...new Set(missingOrExtra)].join(", ")}`);
}

const authorisedHashes = new Set(inlineScriptHashes);
const generatedPages = [
  "index.html",
  "atlas/index.html",
  "mastery/index.html",
  "together/index.html",
  "together/race/index.html",
  "together/cooperative/index.html",
  "together/duel/index.html"
];
const usedHashes = new Set();

for (const page of generatedPages) {
  const html = await readFile(resolve(root, "dist", page), "utf8");
  const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.length);

  for (const source of inlineScripts) {
    const digest = createHash("sha256").update(source, "utf8").digest("base64");
    const hash = `'sha256-${digest}'`;
    usedHashes.add(hash);
    if (!authorisedHashes.has(hash)) {
      throw new Error(`${page} contains an inline script that is not authorised by the production CSP: ${hash}`);
    }
  }
}

for (const hash of authorisedHashes) {
  if (!usedHashes.has(hash)) throw new Error(`The production CSP contains an unused inline script hash: ${hash}`);
  if (!directives.get("script-src")?.includes(hash)) throw new Error(`script-src is missing the authorised inline hash: ${hash}`);
}

console.log(
  `Verified ${expectedKeys.length} security headers, ${requiredDirectives.length} CSP directives and ` +
  `${usedHashes.size} exact inline script hashes.`
);
