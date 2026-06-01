import { prisma } from "./db.ts";

async function main() {
    const msgs = await prisma.message.findMany({
        orderBy: { createdAt: "desc" },
        take: 5
    });
    console.log(JSON.stringify(msgs, null, 2));
}

main().finally(() => prisma.$disconnect());
