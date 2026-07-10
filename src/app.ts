import express, { Request, Response, NextFunction } from "express";
import db from "./config/database";
import apiRoutes from "./routes/apiRoutes";
import logger from "./utils/logger";

const app = express();

app.use(express.json());

// Logger middleware for incoming requests
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`HTTP ${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
  });
  next();
});

// Health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  try {
    // Run a query to test database connectivity
    await db.raw("SELECT 1");
    return res.status(200).json({
      status: "ok",
      db: "healthy",
    });
  } catch (error: any) {
    logger.error("Health check failed", { error: error.message });
    return res.status(503).json({
      status: "error",
      db: "unhealthy",
    });
  }
});

// API routes
app.use("/api", apiRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error occurred", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal Server Error" });
});

export default app;
