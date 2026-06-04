// Shared SSRF guard for tenant-configurable outbound HTTP endpoints.
// Restricts protocols to https only and blocks private / link-local / loopback / metadata destinations.

const BLOCKED_HOST_LITERALS = new Set([
  "localhost",
  "0.0.0.0",
  "::",
  "::1",
  "169.254.169.254", // cloud metadata
  "metadata.google.internal",
]);

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH"]);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique-local
  if (h.startsWith("fe80")) return true; // link-local
  return false;
}

export function validateOutboundUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Only https:// URLs are allowed for custom providers");
  }
  const host = url.hostname.toLowerCase();
  if (!host) throw new Error("URL host is required");
  if (BLOCKED_HOST_LITERALS.has(host)) {
    throw new Error("Blocked host");
  }
  if (host.endsWith(".internal") || host.endsWith(".local") || host.endsWith(".localhost")) {
    throw new Error("Blocked host");
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    throw new Error("Private or reserved IP addresses are not allowed");
  }
  if (url.port) {
    const p = Number(url.port);
    if (![80, 443, 8080, 8443].includes(p)) {
      throw new Error("Only standard https ports are allowed");
    }
  }
  return url;
}

export function validateMethod(method: string | undefined | null): string {
  const m = (method || "POST").toUpperCase();
  if (!ALLOWED_METHODS.has(m)) {
    throw new Error(`HTTP method ${m} is not allowed`);
  }
  return m;
}
