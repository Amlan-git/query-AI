import { PrismaClient } from "./prisma/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Reuse a single PrismaClient across warm serverless invocations.
 *
 * Each Vercel function instance keeps its globals between requests as long as
 * the container is warm. Without this guard, hot-reload in dev and warm
 * invocations on Vercel would each construct a new pg pool, exhausting
 * Supabase's direct-connection cap. Pair this with the Supabase **Transaction
 * Pooler** URL (port 6543, `?pgbouncer=true&connection_limit=1`) in
 * production.
 */
const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient;
};

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
    }
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
