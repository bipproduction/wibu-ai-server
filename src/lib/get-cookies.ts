import { parseNetscapeCookies } from "./parse-cookies";
import { printLog } from "../utils/debug";

const cookiesText = Buffer.from(process.env.APP_COOKIES!, "base64").toString(
  "utf-8"
);

export async function getCookies({
  isDebug = false
}: { isDebug?: boolean } = {}) {
  const debug = printLog(isDebug);
  debug("Loading cookies...");
  const cookies = parseNetscapeCookies(cookiesText);
  debug(`Loaded ${cookies.length} cookies`);
  return cookies;
}
