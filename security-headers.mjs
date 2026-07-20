export const inlineScriptHashes = [
  "'sha256-DDqfNVv+/g72mYuoRoJyfO+MyqEYLxWKQbcrGASHvWw='",
  "'sha256-Sb1wq0NK5+7zBdqwvyFr3pV2dNBBD66hhQr2OZHvBXs='",
  "'sha256-Cm5coHPAm0fPMTiOdBnROZaPpqJHd7JkbZVoEaBdV/4='"
];

export const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  `script-src 'self' ${inlineScriptHashes.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://gxtrcjuhlgkpanqndtwy.supabase.co wss://gxtrcjuhlgkpanqndtwy.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests"
].join("; ");

export const securityHeaders = {
  "Content-Security-Policy": contentSecurityPolicy,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "off",
  "X-Frame-Options": "SAMEORIGIN"
};
