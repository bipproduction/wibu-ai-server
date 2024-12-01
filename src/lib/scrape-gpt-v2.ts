import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page } from "puppeteer";
import { htmlToMarkdown } from "webforai";
import { TIMEOUT } from "../utils/constant-value";
import { getCookies } from "./get-cookies";
import { waitForButtonDisabled } from "./wait-for-button-disabled";
import { printLog } from "../utils/debug";

// Initialize stealth plugin
puppeteerExtra.use(StealthPlugin());

// Custom error class for scraping errors
class ScrapingError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = "ScrapingError";
  }
}

interface ScraperOptions {
  headless?: boolean;
  isDebug?: boolean;
  maxRetries?: number;
  requestTimeout?: number;
}

const DEFAULT_OPTIONS: Required<ScraperOptions> = {
  headless: true,
  isDebug: false,
  maxRetries: 3,
  requestTimeout: TIMEOUT.navigation
};

export async function scrapeChatGPTV2(
  query: string,
  options: ScraperOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const debug = printLog(opts.isDebug);
  let browser: Browser | null = null;
  let retryCount = 0;

  while (retryCount < opts.maxRetries) {
    try {
      browser = await initializeBrowser(opts.headless);
      const result = await performScraping(
        browser,
        query,
        debug,
        opts.requestTimeout
      );
      return result;
    } catch (error) {
      retryCount++;
      debug(`Attempt ${retryCount}/${opts.maxRetries} failed:`, error);

      if (browser) {
        await browser.close();
        browser = null;
      }

      if (retryCount === opts.maxRetries) {
        throw new ScrapingError(
          `Failed to scrape after ${opts.maxRetries} attempts`,
          error instanceof Error ? error : undefined
        );
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, retryCount) * 1000)
      );
    }
  }

  throw new ScrapingError(
    "Unexpected error: Max retries reached without resolution"
  );
}

async function clickSubmitButton(page: Page): Promise<void> {
  await page.waitForSelector('button[data-testid="send-button"]', {
    visible: true,
    timeout: TIMEOUT.element
  });

  await page.click('button[data-testid="send-button"]');
}
async function initializeBrowser(headless: boolean): Promise<Browser> {
  return await puppeteerExtra.launch({
    headless,
    defaultViewport: { width: 720, height: 600 },
    args: [
      "--no-sandbox",
      //   "--disable-setuid-sandbox",
      //   "--disable-dev-shm-usage",
      //   "--disable-accelerated-2d-canvas",
      //   "--disable-gpu",
      "--window-size=720,600",
      "--disable-web-security"
      //   "--ignore-certificate-errors",
      //   "--ignore-certificate-errors-spki-list",
      //   "--allow-running-insecure-content",
      //   "--disable-blink-features=AutomationControlled",
      //   "--disable-features=IsolatedOrigins",
      //   "--disable-features=SitePerProcess",
      //   "--disable-features=WebAssembly",
      //   "--disable-features=WebAssemblyWebGL"
    ]
  });
}

async function setupPage(
  page: Page,
  debug: (message: string, ...args: any[]) => void
): Promise<void> {
  await Promise.all([
    page.setDefaultTimeout(TIMEOUT.element),
    page.setDefaultNavigationTimeout(TIMEOUT.navigation),
    page.emulateTimezone("America/New_York"),
    page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    page.setRequestInterception(true)
  ]);

  // Optimize resource loading
  page.on("request", (request) => {
    const resourceType = request.resourceType();
    if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
      request.abort();
    } else {
      request.continue();
    }
  });

  // Set cookies
  const cookies = await getCookies();
  debug(`Loading ${cookies.length} cookies...`);

  await Promise.all(
    cookies.map((cookie) =>
      page.setCookie(cookie).catch((error) => {
        debug(`Failed to set cookie ${cookie.name}:`, error);
      })
    )
  );
}

async function performScraping(
  browser: Browser,
  query: string,
  debug: (message: string, ...args: any[]) => void,
  requestTimeout: number
): Promise<string> {
  const [page] = await browser.pages();

  try {
    debug("Setting up page...");
    await setupPage(page, debug);

    debug("Navigating to ChatGPT...");
    await page.goto("https://chatgpt.com/?temporary-chat=true", {
      waitUntil: "networkidle0",
      timeout: requestTimeout
    });

    debug("Waiting for textarea...");
    const textareaSelector = "textarea";
    await page.waitForSelector(textareaSelector, {
      timeout: TIMEOUT.element
    });

    // Type with random delays to appear more human-like
    await page.type(textareaSelector, query, {
      delay: Math.floor(Math.random() * 100) + 50
    });

    debug("Clicking submit button...");
    await clickSubmitButton(page);

    debug("Waiting for button to be disabled...");
    await waitForButtonDisabled(page);

    debug("Waiting for response...");
    const response = await page.evaluate(() => {
      const selector = ".markdown:last-of-type";
      const lastResponse = document.querySelector(selector);
      if (!lastResponse) throw new Error("Response element not found");
      return lastResponse.innerHTML;
    });

    debug("Converting response to Markdown...");
    return htmlToMarkdown(response);
  } finally {
    debug("Closing browser...");
    await page.close();
    await browser.close();
  }
}
