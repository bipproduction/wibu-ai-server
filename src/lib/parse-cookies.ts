import type { Cookie } from "puppeteer";
import { printLog } from "../utils/debug";

export function parseNetscapeCookies(
  cookieFileContent: string,
  config: { isDebug: boolean } = { isDebug: false }
): Cookie[] {
  const { isDebug } = config;
  const debug = printLog(isDebug);
  debug("Parsing cookies...");
  const cookies: Cookie[] = [];
  const lines = cookieFileContent.split("\n");

  for (const line of lines) {
    if (line.startsWith("#") || !line.trim()) continue;

    const parts = line.split("\t");
    if (parts.length < 7) continue;

    const [domain, httpOnly, path, secure, expiration, name, value] = parts;

    try {
      // Skip invalid domains
      if (!domain || domain === "") continue;

      // Convert expiration to number or undefined
      let expirationTime: number | undefined;
      if (expiration !== "0") {
        expirationTime = parseInt(expiration);
        if (isNaN(expirationTime)) expirationTime = undefined;
      }

      cookies.push({
        name: name,
        value: value.replace(/^"(.*)"$/, "$1"), // Remove quotes if present
        domain: domain.startsWith(".") ? domain : `.${domain}`,
        path: path || "/",
        expires: expirationTime,
        secure: secure === "TRUE",
        httpOnly: httpOnly === "TRUE",
        sameSite: "Lax" as const
      } as Cookie);
    } catch (error) {
      console.warn(`Failed to parse cookie line: ${line}`, error);
    }
  }

  return cookies;
}
