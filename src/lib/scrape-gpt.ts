import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { htmlToMarkdown } from "webforai";
import { TIMEOUT } from "../utils/constant-value";
import { getCookies } from "./get-cookies";
import { waitForButtonDisabled } from "./wait-for-button-disabled";
import { printLog } from "../utils/debug";
puppeteerExtra.use(StealthPlugin());

export async function scrapeChatGPT(
  q: string,
  {
    headless = true,
    isDebug = false
  }: { headless?: boolean; isDebug?: boolean } = {}
) {
  const debug = printLog(isDebug);
  debug("Starting browser...");

  const browser = await puppeteerExtra.launch({
    headless,
    defaultViewport: { width: 1366, height: 768 },
    args: ["--no-sandbox", "--disable-web-security"]
  });

  try {
    const [page] = await browser.pages();

    debug("Configuring page...");
    await Promise.all([
      page.emulateTimezone("America/New_York"),
      page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
      )
    ]);

    // Set cookies
    const cookies = await getCookies();
    debug(`Loading ${cookies.length} cookies...`);
    for (const cookie of cookies) {
      try {
        await page.setCookie(cookie);
      } catch (error) {
        console.warn(`Failed to set cookie ${cookie.name}:`, error);
      }
    }

    debug("Navigating to ChatGPT...");
    await page.goto("https://chatgpt.com/?temporary-chat=true", {
      waitUntil: "networkidle0",
      timeout: TIMEOUT.navigation
    });

    debug("Waiting for textarea...");
    await page.waitForSelector("textarea", {
      timeout: TIMEOUT.element
    });
    await page.type("textarea", q);
    await page.keyboard.press("Enter");

    debug("Waiting for button to be disabled...");
    await waitForButtonDisabled(page);

    debug("Waiting for response...");
    const response = await page.evaluate((selector) => {
      const lastResponse = document.querySelector(selector);
      return lastResponse ? lastResponse.innerHTML : "No response found";
    }, ".markdown:last-of-type");

    return htmlToMarkdown(response as string);
  } catch (error) {
    debug("Script failed:", error + "");
    throw error;
  } finally {
    await browser.close();
  }
}
