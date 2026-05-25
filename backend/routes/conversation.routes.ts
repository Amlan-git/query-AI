import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../db";
import z from "zod";

// Pagination validation schema for listing conversations
const PaginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0)
});

// Rename conversation validation schema
const UpdateConversationSchema = z.object({
    title: z.string().min(1).max(100).trim()
});

/**
 * Ownership check helper inside conversation.routes.ts
 * Safely checks if a conversation exists (404) before verifying user ownership (403)
 */
const getConversationOrError = async (
    conversationId: string,
    userId: string,
    res: Response
): Promise<{ id: string; userId: string; [key: string]: unknown } | null> => {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
    });
    if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return null;
    }
    if (conversation.userId !== userId) {
        res.status(403).json({ error: "Access denied" });
        return null;
    }
    return conversation;
};

const router = Router();

// ROUTE 1: GET / - List all conversations for the logged-in user (paginated)
router.get("/", async (req, res) => {
    const parseResult = PaginationSchema.safeParse(req.query);
    if (!parseResult.success) {
        res.status(400).json({
            error: "Invalid query parameters",
            details: parseResult.error.flatten().fieldErrors
        });
        return;
    }
    const { limit, offset } = parseResult.data;

    try {
        const conversations = await prisma.conversation.findMany({
            where: { userId: req.user!.id },
            orderBy: { updatedAt: "desc" },
            take: limit,
            skip: offset,
            select: {
                id: true,
                title: true,
                slug: true,
                createdAt: true,
                updatedAt: true,
                _count: { select: { messages: true } }
            }
        });

        console.log(`[conversations] Listed ${conversations.length} conversations for user: ${req.user!.id}`);

        res.status(200).json({
            data: conversations,
            pagination: { limit, offset, count: conversations.length }
        });
    } catch (err: unknown) {
        console.error("[conversations] Failed to list conversations:", err);
        res.status(500).json({ error: "Failed to fetch conversations" });
    }
});

// ROUTE 2: GET /:conversationId - Get a single conversation with all its messages
router.get("/:conversationId", async (req, res) => {
    const { conversationId } = req.params;

    try {
        const conversation = await getConversationOrError(conversationId, req.user!.id, res);
        if (!conversation) return;

        // Retrieve full conversation with messages, explicitly scoped by userId
        const fullConversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                userId: req.user!.id
            },
            include: {
                messages: {
                    orderBy: { createdAt: "asc" }
                }
            }
        });

        console.log(`[conversations] Retrieved conversation details for id: ${conversationId}`);
        res.status(200).json({ data: fullConversation });
    } catch (err: unknown) {
        console.error("[conversations] Failed to retrieve conversation:", err);
        res.status(500).json({ error: "Failed to fetch conversation details" });
    }
});

// ROUTE 3: PATCH /:conversationId - Rename a conversation title
router.patch("/:conversationId", async (req, res) => {
    const { conversationId } = req.params;

    try {
        const conversation = await getConversationOrError(conversationId, req.user!.id, res);
        if (!conversation) return;

        const parseResult = UpdateConversationSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({
                error: "Invalid request payload",
                details: parseResult.error.flatten().fieldErrors
            });
            return;
        }

        const updatedConversation = await prisma.conversation.update({
            where: { id: conversationId },
            data: { title: parseResult.data.title }
        });

        console.log(`[conversations] Renamed conversation title for id: ${conversationId}`);
        res.status(200).json({ data: updatedConversation });
    } catch (err: unknown) {
        console.error("[conversations] Failed to rename conversation:", err);
        res.status(500).json({ error: "Failed to update conversation" });
    }
});

// ROUTE 4: DELETE /:conversationId - Delete a conversation and all its messages
router.delete("/:conversationId", async (req, res) => {
    const { conversationId } = req.params;

    try {
        const conversation = await getConversationOrError(conversationId, req.user!.id, res);
        if (!conversation) return;

        await prisma.conversation.delete({
            where: { id: conversationId }
        });

        console.log(`[conversations] Deleted conversation for id: ${conversationId}`);
        res.status(204).send();
    } catch (err: unknown) {
        console.error("[conversations] Failed to delete conversation:", err);
        res.status(500).json({ error: "Failed to delete conversation" });
    }
});

export default router;
