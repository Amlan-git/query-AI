import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../db";
import { createSupabaseClient } from "../client";
import z from "zod";

// Validation schema for signing up/signing in OAuth users.
// Ensures that credentials like name and provider are strictly validated at the API edge.
const SignupSchema = z.object({
    name: z.string().min(1, "Name cannot be empty").max(100).trim(),
    provider: z.enum(["GOOGLE", "GITHUB"])
});

/**
 * Helper to safely extract a Bearer token from the incoming Request authorization header.
 * Sourced inline at the module level to ensure DRY principles are respected across both auth endpoints.
 */
const extractBearerToken = (req: Request): string | null => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    return header.split(" ")[1] ?? null;
};

const router = Router();

router.post("/signup", async (req: Request, res: Response) => {
    // 1. Validate request body at the network boundary using Zod schema
    const parseResult = SignupSchema.safeParse(req.body);
    if (!parseResult.success) {
        console.warn("[signup] Failure: Invalid body payload", parseResult.error.flatten().fieldErrors);
        res.status(400).json({
            error: "Invalid request",
            details: parseResult.error.flatten().fieldErrors
        });
        return;
    }

    // 2. Extract Bearer token from headers using helper
    const token = extractBearerToken(req);
    if (!token) {
        console.warn("[signup] Failure: No token provided");
        res.status(401).json({ error: "No token provided" });
        return;
    }

    // 3. Verify JWT with a fresh Supabase client instance
    // INLINE COMMENT: A fresh Supabase client instance is created per request to avoid session/auth state
    // leaks across concurrent requests. Reusing a module-level service-role client is unsafe.
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        console.warn("[signup] Failure: Invalid or expired token", error?.message);
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    try {
        // 4. Sync/Upsert user in the local Prisma PostgreSQL database
        // INLINE COMMENT: Sourcing user.email and user.id from the verified Supabase JWT rather than
        // the untrusted request body is critical. This prevents malicious clients from claiming
        // arbitrary emails or impersonating other user IDs.
        // INLINE COMMENT: Using `upsert` instead of `create` handles potential race conditions or
        // repeat signup requests gracefully (e.g. if the user clears local storage/cookies and
        // signs up again) without throwing unique constraint violations.
        const user = await prisma.user.upsert({
            where: { id: data.user.id },
            update: { name: parseResult.data.name },
            create: {
                id: data.user.id,
                email: data.user.email!,
                name: parseResult.data.name,
                provider: parseResult.data.provider
            }
        });

        console.log(`[signup] Success: User synced/upserted to database (ID: ${user.id})`);
        res.status(200).json({ data: user });
    } catch (dbError: unknown) {
        // INLINE COMMENT: Wrap the Prisma upsert in a try/catch separate from token validation.
        // Log the actual DB exception on the server and return a generic 500 error to avoid
        // leaking internal database structure, tables, or configuration details to the client.
        console.error("[signup] DB Error syncing user:", dbError);
        res.status(500).json({ error: "Failed to create user account" });
    }
});

router.post("/signin", async (req: Request, res: Response) => {
    // 1. Validate request body at the network boundary using shared Zod schema
    const parseResult = SignupSchema.safeParse(req.body);
    if (!parseResult.success) {
        console.warn("[signin] Failure: Invalid body payload", parseResult.error.flatten().fieldErrors);
        res.status(400).json({
            error: "Invalid request",
            details: parseResult.error.flatten().fieldErrors
        });
        return;
    }

    // 2. Extract Bearer token from headers using helper
    const token = extractBearerToken(req);
    if (!token) {
        console.warn("[signin] Failure: No token provided");
        res.status(401).json({ error: "No token provided" });
        return;
    }

    // 3. Verify JWT with a fresh Supabase client instance
    // INLINE COMMENT: A fresh Supabase client instance is created per request to avoid session/auth state
    // leaks across concurrent requests. Reusing a module-level service-role client is unsafe.
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        console.warn("[signin] Failure: Invalid or expired token", error?.message);
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    try {
        // 4. Sync/Upsert user in the local Prisma PostgreSQL database
        // INLINE COMMENT: Sourcing user.email and user.id from the verified Supabase JWT rather than
        // the untrusted request body is critical. This prevents malicious clients from claiming
        // arbitrary emails or impersonating other user IDs.
        // INLINE COMMENT: Using `upsert` instead of `findUnique` handles the edge case where the database
        // is wiped or reset in development/production but the user still exists in Supabase. It auto-heals
        // the record instead of failing.
        const user = await prisma.user.upsert({
            where: { id: data.user.id },
            update: { name: parseResult.data.name },
            create: {
                id: data.user.id,
                email: data.user.email!,
                name: parseResult.data.name,
                provider: parseResult.data.provider
            }
        });

        console.log(`[signin] Success: User signed in and verified (ID: ${user.id})`);
        res.status(200).json({ data: user });
    } catch (dbError: unknown) {
        // INLINE COMMENT: Wrap the Prisma upsert in a try/catch separate from token validation.
        // Log the actual DB exception on the server and return a generic 500 error to avoid
        // leaking internal database details.
        console.error("[signin] DB Error syncing/finding user:", dbError);
        res.status(500).json({ error: "Failed to sign in user" });
    }
});

export default router;
