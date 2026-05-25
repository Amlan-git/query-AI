import express from "express";
import {
  applyGlobalMiddleware,
  verifyToken,
  rateLimiter,
  errorHandler
} from "./middleware";
import authRouter from "./routes/auth.routes";
import searchRouter from "./routes/search.routes";
import conversationRouter from "./routes/conversation.routes";

const app = express();

// Register global security (helmet, cors, limiters, loggers)
applyGlobalMiddleware(app);

// Apply general rate limiting globally
app.use(rateLimiter);

// Apply global JWT verification
app.use(verifyToken);

// Mount logical routes
app.use("/", authRouter);
app.use("/", searchRouter);
app.use("/conversations", conversationRouter);

// Global error handler middleware to catch any uncaught express exceptions
app.use(errorHandler);

app.listen(3001, () => {
    console.log("[server] Quest backend running on port 3001");
});
