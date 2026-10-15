/**
 * @file index.ts
 * @description Application Entry Point.
 * Initializes the Express server, configures middleware, registers routes, and starts listening.
 * 
 * @functionality
 * - Server Setup: Bootstraps Express app.
 * - Middleware: JSON parsing, URL encoding, custom logging.
 * - Route Registration: Delegates to `routes.ts`.
 * - Dev/Prod Mode: Configures Vite dev server (dev) or static serving (prod).
 * - Port Binding: Defaults to 5000.
 * 
 * @dependencies
 * - express: Web framework.
 * - dotenv/config: Loads environment variables immediately.
 * - vite.ts: Handles development server integration.
 * 
 * @breaking-changes
 * - Port 5000: Hardcoded expectation for Replit environment.
 * - Middleware Order: Logging and JSON parsing must occur before routes.
 */

import "dotenv/config"; // Load env vars before anything else
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupCronJobs } from "./cron";

const app = express();

import helmet from "helmet";

// Trust proxy for production deployment
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "blob:"],
      scriptSrc: [
        "'self'",
        ...(app.get("env") === "development" ? ["'unsafe-inline'"] : []),
        "https://*.googleapis.com",
        "https://*.gstatic.com",
        "https://*.replit.com",
        "https://replit.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://*.googleapis.com", "https://*.replit.com"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.replit.com", "https://replit.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Often causes issues with 3rd party scripts/images
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  setupCronJobs();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5001", 10);
  const host = process.env.HOST || "0.0.0.0";
  server.listen({
    port,
    host,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
