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
import usersRouter from "./api/users";
import { requireAuth } from './lib/auth';
import {
  getStudySessions,
  getStudySession,
  createStudySession,
  updateStudySession,
  deleteStudySession
} from "./api/studySessions";

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
app.use("/api/users", usersRouter);

// Study Sessions routes
app.get("/api/study-sessions", async (req, res) => {
  try {
    const response = await getStudySessions(req);
    const status = response.status;
    const body = await response.json();
    res.status(status).json(body);
  } catch (error) {
    console.error("Error in study sessions route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/study-sessions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const response = await getStudySession(req, id);
    const status = response.status;
    const body = await response.json();
    res.status(status).json(body);
  } catch (error) {
    console.error("Error in get study session route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/study-sessions", async (req, res) => {
  try {
    const response = await createStudySession(req);
    const status = response.status;
    const body = await response.json();
    res.status(status).json(body);
  } catch (error) {
    console.error("Error in create study session route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/study-sessions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const response = await updateStudySession(req, id);
    const status = response.status;
    const body = await response.json();
    res.status(status).json(body);
  } catch (error) {
    console.error("Error in update study session route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/study-sessions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const response = await deleteStudySession(req, id);
    const status = response.status;
    const body = await response.json();
    res.status(status).json(body);
  } catch (error) {
    console.error("Error in delete study session route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Development setup
if (process.env.NODE_ENV === "development") {
  setupVite(app, server);
} else {
  serveStatic(app);
}

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
