import express from "express";
import { createServer } from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import apiRouter from "./routes/api";
import authRouter from "./routes/auth";
import { setupVite, serveStatic, log } from "./vite";
import generateSubtasksRoute from "./routes/generate-subtasks";
import settingsRouter from "./routes/settings";

// Load environment variables from .env file
dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

// Routes
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);
app.use("/api/generate", generateSubtasksRoute);
app.use("/api/settings", settingsRouter);

// Development setup
if (process.env.NODE_ENV === "development") {
  setupVite(app, server);
} else {
  serveStatic(app);
}

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});