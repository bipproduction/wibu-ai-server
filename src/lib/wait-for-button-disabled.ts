import type { Page } from "puppeteer";
import { TIMEOUT } from "../utils/constant-value";
import { printLog } from "../utils/debug";

export async function waitForButtonDisabled(
  page: Page,
  config: { isDebug: boolean } = { isDebug: false }
): Promise<void> {
  const { isDebug } = config;
  const debug = printLog(isDebug);
  debug("Waiting for button to be disabled...");
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = TIMEOUT.button / 1000;

    debug("Checking button status...");
    const checkButton = async () => {
      try {
        const isDisabled = await page.evaluate((selector) => {
          const button = document.querySelector(selector);
          return button?.hasAttribute("disabled");
        }, '[data-testid="send-button"]');

        debug("Button status:", isDisabled ? "disabled" : "enabled");
        if (isDisabled || attempts++ >= maxAttempts) {
          debug("Response complete - Send button is disabled");
          resolve();
        } else {
          debug("Waiting for button to be disabled...");
          setTimeout(checkButton, 1000);
        }
      } catch (error) {
        debug("Error checking button status:", error);
        console.error("Error checking button status:", error);
        resolve();
      }
    };

    checkButton();
  });
}
