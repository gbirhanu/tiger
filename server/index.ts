import express from "express";
import { createServer } from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import apiRouter from "./routes/api";
import authRouter from "./routes/auth";
import { setupVite, serveStatic } from "./vite";
import generateSubtasksRoute from "./routes/generate-subtasks";
import generateContentRoute from "./routes/generate-content";
import settingsRouter from "./routes/settings";

import usersRouter from "./api/users";
import { requireAuth } from './lib/auth';
import {
  getStudySessions,
  getStudySession,
  createStudySession,
  updateStudySession,
  deleteStudySession,
  getUserFromRequest
} from "./api/studySessions";
import subscriptionRoutes from './routes/subscription';
import emailRoutes from "./routes/email";
import { GET_GOOGLE_CLIENT_ID } from "./api/admin/env-variables";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../shared/db";
import { studySessions } from "../shared/schema";

// Load environment variables from .env file
dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || 
         (process.env.NODE_ENV === "production" ? 
          process.env.PRODUCTION_CLIENT_URL : 
          "http://localhost:5173"),
  credentials: true
}));

// Routes
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);
app.use("/api/generate", generateSubtasksRoute);
app.use("/api/generate-content", generateContentRoute);
app.use("/api/settings", settingsRouter);
app.use("/api/users", usersRouter);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/email", emailRoutes);

// Truly public route (outside of /api/ path to avoid any global auth middleware)
app.get('/public/google-client-id', GET_GOOGLE_CLIENT_ID);

// Public routes (no authentication required)
app.get('/api/public/google-client-id', GET_GOOGLE_CLIENT_ID);

// Original route (might have authentication middleware applied)
app.get('/api/admin/env-variables/google-client-id', GET_GOOGLE_CLIENT_ID);

// Register admin routes for environment variables
app.post("/api/admin/env-variables", requireAuth, async (req, res) => {
  try {
    const { POST } = await import('./api/admin/env-variables');
    return await POST(req, res);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Add GET route for env-variables
app.get("/api/admin/get-env-variables", requireAuth, async (req, res) => {
  try {
    const { GET } = await import('./api/admin/env-variables');
    return await GET(req, res);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Study Sessions routes
app.get("/api/study-sessions", async (req, res) => {
  try {
    const response = await getStudySessions(req);
    const status = response.status;
    const body = await response.json();
    res.status(status).json(body);
  } catch (error) {
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
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add PATCH endpoint for study sessions (modern RESTful API convention)
app.patch("/api/study-sessions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const response = await updateStudySession(req, id);
    const status = response.status;
    const body = await response.json();
    res.status(status).json(body);
  } catch (error) {
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
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add a direct force-complete endpoint that explicitly sets completed=true in the database
app.post("/api/study-sessions/:id/force-complete", async (req, res) => {
  try {
    const id = req.params.id;
    
    // Get user from auth token
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Extract additional data from the request body
    const { total_focus_time, total_breaks } = req.body;
    
    // Use Drizzle's SQL template literal for direct SQL execution
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const numericId = parseInt(id);
      
      // Use Drizzle ORM's direct update with logging
      const result = await db
        .update(studySessions)
        .set({ 
          completed: sql`1`, // Use SQL literal to ensure it's treated as a raw value
          updated_at: timestamp,
          ...(total_focus_time !== undefined ? { total_focus_time } : {}),
          ...(total_breaks !== undefined ? { total_breaks } : {})
        })
        .where(and(
          eq(studySessions.id, numericId),
          eq(studySessions.user_id, user.id)
        ));
      
      // Fetch the updated session to return
      const updatedSession = await db
        .select()
        .from(studySessions)
        .where(and(
          eq(studySessions.id, numericId),
          eq(studySessions.user_id, user.id)
        ));
        
      if (!updatedSession.length) {
        return res.status(404).json({ error: "Study session not found" });
      }
      
      return res.status(200).json(updatedSession[0]);
      
    } catch (dbError) {
      return res.status(500).json({ 
        error: "Database error when force-completing study session",
        details: dbError instanceof Error ? dbError.message : "Unknown database error"
      });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error when force-completing study session" });
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
