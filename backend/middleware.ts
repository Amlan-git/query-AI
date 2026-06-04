import type { NextFunction, Request, Response, Express } from "express";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { User } from "@supabase/supabase-js";
import { createSupabaseClient } from "./client";
import { prisma } from "./db";
import { AuthProvider } from "./prisma/generated/enums";

// Initialize Supabase Client for JWT verification
const client = createSupabaseClient();

// Extend the Express Request type to include the user property typed properly
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * JWT Verification Middleware
 * Validates the Supabase-issued Bearer token on all non-public incoming requests.
 * Attaches the authenticated user to `req.user`.
 */
export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  // Define public routes exclusion list (method and path pairings)
  const publicRoutes = [
    { method: "POST", path: "/api/auth/login" },
    { method: "POST", path: "/api/auth/logout" },
    { method: "GET", path: "/api/auth/callback" },
    { method: "GET", path: "/health" },
    { method: "POST", path: "/signup" },
    { method: "POST", path: "/signin" }
  ];

  // Standardize the path by removing trailing slash if present (except for root)
  const path = req.path.endsWith("/") && req.path.length > 1 ? req.path.slice(0, -1) : req.path;

  // Skip authentication check if it's a public route
  const isPublic = publicRoutes.some(
    (route) => route.method === req.method && route.path === path
  );

  if (isPublic) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  if (!authHeader) {
    console.warn(`[auth-fail] ${req.method} ${req.path} | reason: No token provided | ip: ${ip}`);
    return res.status(401).json({ error: "No token provided" });
  }

  const parts = authHeader.split(" ");
  const scheme = parts[0];
  const token = parts[1];

  if (parts.length !== 2 || !scheme || !token || scheme.toLowerCase() !== "bearer") {
    console.warn(`[auth-fail] ${req.method} ${req.path} | reason: Invalid authorization format | ip: ${ip}`);
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    // Validate the JWT against Supabase's auth service directly (no manual secret verification)
    const { data, error } = await client.auth.getUser(token);

    if (error || !data || !data.user) {
      console.warn(
        `[auth-fail] ${req.method} ${req.path} | reason: ${error?.message || "User not found"} | ip: ${ip}`
      );
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Attach user object securely to request context
    req.user = data.user;
    return next();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[auth-fail] ${req.method} ${req.path} | reason: Internal auth error (${errorMsg}) | ip: ${ip}`);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Backward compatibility exports to support index.ts imports.
 * maps authenticateUser to verifyToken, and requireAuth to verify existence of user context.
 */
export const authenticateUser = verifyToken;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    console.warn(`[auth-fail] ${req.method} ${req.path} | reason: Unauthorized access | ip: ${ip}`);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  return next();
}

function getUserProfile(user: User) {
  const rawProvider = user.app_metadata?.provider;
  const provider = rawProvider === "github" ? AuthProvider.GITHUB : AuthProvider.GOOGLE;
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "User";

  return { name, provider };
}

export async function ensureAppUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next();
  }

  if (!req.user.email) {
    console.warn(`[user-sync] Missing email for authenticated user: ${req.user.id}`);
    return res.status(400).json({ error: "Authenticated user is missing an email address" });
  }

  const { name, provider } = getUserProfile(req.user);

  try {
    await prisma.user.upsert({
      where: { id: req.user.id },
      update: {
        email: req.user.email,
        name,
        provider
      },
      create: {
        id: req.user.id,
        email: req.user.email,
        name,
        provider
      }
    });
    return next();
  } catch (err: unknown) {
    console.error("[user-sync] Failed to sync authenticated user:", err);
    return res.status(500).json({ error: "Failed to initialize user profile" });
  }
}

/**
 * General Rate Limiter Middleware
 * 60 requests per 15 minutes per IP.
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true, // Return rate limit info in standard headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: { error: "Too many requests, slow down" },
});

/**
 * Search-Specific Stricter Rate Limiter
 * 20 requests per minute per authenticated user (by user ID).
 * Falls back to IP or 'unknown' if authentication has not run/failed.
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.user?.id || ipKeyGenerator(req.ip || "unknown");
  },
  message: { error: "Too many requests, slow down" },
});

/**
 * Request Logging Middleware
 * Logs all completed requests upon response finish.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    const userId = req.user ? req.user.id : "guest";
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const timestamp = new Date().toISOString();
    console.log(`[middleware] ${req.method} ${req.path} | user: ${userId} | ip: ${ip} | time: ${timestamp}`);
  });
  next();
}

/**
 * Global Error Handling Middleware
 * Gracefully logs unhandled errors and returns standardized responses without leaking stack traces.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // Express identifies error handlers by checking parameter arity (exactly 4 arguments).
  // Keeping next parameter here is critical for Express middleware mapping.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorStack = err instanceof Error ? err.stack : undefined;

  console.error(`[error] ${req.method} ${req.path} | error: ${errorMessage} | ip: ${ip}`);

  const isProduction = process.env.NODE_ENV === "production";

  res.status(500).json({
    error: isProduction ? "Internal server error" : errorMessage,
    ...(!isProduction && errorStack ? { stack: errorStack } : {}),
  });
}

/**
 * Registers global application-wide middlewares:
 * - helmet (secure headers)
 * - cors (strict configured origin)
 * - express.json (10kb body payload limitation)
 * - requestLogger (global logging setup)
 */
export function applyGlobalMiddleware(app: Express) {
  // 1. Secure HTTP Headers
  app.use(helmet());

  // 2. Strict CORS Configuration
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    })
  );

  // 3. Payload Attack Protection
  app.use(express.json({ limit: "10kb" }));

  // 4. Global Logging
  app.use(requestLogger);
}
