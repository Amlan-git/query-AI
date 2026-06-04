import express from "express";
import {
  applyGlobalMiddleware,
  verifyToken,
  ensureAppUser,
  rateLimiter,
  errorHandler
} from "./middleware";
import authRouter from "./routes/auth.routes";
import searchRouter from "./routes/search.routes";
import conversationRouter from "./routes/conversation.routes";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";

// Register global security (helmet, cors, limiters, loggers)
applyGlobalMiddleware(app);

// Apply general rate limiting globally
app.use(rateLimiter);

app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
});

// Apply global JWT verification
app.use(verifyToken);
app.use(ensureAppUser);

// Mount logical routes
app.use("/", authRouter);
app.use("/", searchRouter);
app.use("/conversations", conversationRouter);

// Global error handler middleware to catch any uncaught express exceptions
app.use(errorHandler);

export default app;

if (!process.env.VERCEL) {
    const server = app.listen(PORT, HOST);

    server.once("listening", () => {
        console.log(`[server] Query backend running at http://${HOST}:${PORT}`);
    });

    server.once("error", (error: NodeJS.ErrnoException) => {
        console.error(`[server] Failed to start Query backend on ${HOST}:${PORT}:`, error);
        process.exitCode = 1;
    });
}
