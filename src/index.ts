import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import asyncLock from "async-lock";
import { scrapeChatGPTV2 } from "./lib/scrape-gpt-v2";
import minimist from "minimist";

const args = minimist(process.argv.slice(2));

// Inisialisasi async-lock untuk queueing
const lock = new asyncLock();
const LOCK_KEY = "scraping";
const APP_HEADLESS = process.env.APP_HEADLESS === "true";
const APP_DEBUG = process.env.APP_DEBUG === "true";

const app = express();
const port = args.port || args.p || 3000;

// Rate limiter configuration
const limiter = rateLimit({
  windowMs: 2000, // 2 detik
  max: 1, // Maksimal 1 request per 2 detik
  message: {
    status: "error",
    message: "Too many requests, please try again later"
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Terapkan rate limit ke semua routes
app.use(limiter);

const nodeEnv = process.env.NODE_ENV;

if (nodeEnv !== "development") {
  app.use((req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
      res.status(401).json({ status: "error", message: "Unauthorized" });
      return;
    }
    const token = authorization.split(" ")[1];
    if (!token) {
      res.status(401).json({
        status: "error",
        message: "Unauthorized"
      });
      return;
    }

    if (token !== process.env.AUTH_TOKEN) {
      res.status(401).json({
        status: "error",
        message: "Unauthorized"
      });
      return;
    }

    next();
  });
}

// Route untuk scraping
app.get("/ask/:q", async (req: Request, res: Response) => {
  const q = req.params.q;

  if (!q || q.trim() === "") {
    res.status(400).json({
      status: "error",
      message: "Query parameter is required"
    });
    return;
  }

  try {
    // Gunakan async-lock untuk memastikan hanya satu proses scraping berjalan
    const result = await lock.acquire(LOCK_KEY, async () => {
      return await scrapeChatGPTV2(q, {
        headless: APP_HEADLESS,
        isDebug: APP_DEBUG
      });
    });

    res.json({
      status: "success",
      data: result,
      queueInfo: {
        isLocked: lock.isBusy(LOCK_KEY)
      }
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({
      status: "error",
      message: "Error processing request",
      queueInfo: {
        isLocked: lock.isBusy(LOCK_KEY)
      }
    });
  }
});

// Status endpoint
app.get("/status", (req: Request, res: Response) => {
  res.json({
    status: "success",
    queueInfo: {
      isLocked: lock.isBusy(LOCK_KEY)
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
