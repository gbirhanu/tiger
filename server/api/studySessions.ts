import { eq, and } from "drizzle-orm";
import { db } from "../../shared/db";
import { studySessions, insertStudySessionSchema } from "../../shared/schema";
import { validateSession } from "../lib/auth";
import { z } from "zod";
import { Request as ExpressRequest } from "express";

export async function getUserFromRequest(req: ExpressRequest): Promise<{ id: number } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const sessionId = authHeader.split(" ")[1];
  const userId = await validateSession(sessionId);
  
  return userId ? { id: userId } : null;
}

export async function getStudySessions(req: ExpressRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const userStudySessions = await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.user_id, user.id));

    return new Response(JSON.stringify(userStudySessions), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching study sessions:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch study sessions" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function getStudySession(req: ExpressRequest, id: string) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const studySession = await db
      .select()
      .from(studySessions)
      .where(and(
        eq(studySessions.id, parseInt(id)),
        eq(studySessions.user_id, user.id)
      ));

    if (!studySession.length) {
      return new Response(JSON.stringify({ error: "Study session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(studySession[0]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching study session:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch study session" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function createStudySession(req: ExpressRequest) {
  
  
  const user = await getUserFromRequest(req);
  
  
  if (!user) {
    
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    
    const body = req.body; // Express already parses JSON body
    
    
    
    const validatedData = insertStudySessionSchema.parse(body);
    

    
    const newStudySession = await db
      .insert(studySessions)
      .values({
        ...validatedData,
        user_id: user.id,
      })
      .returning();
    

    return new Response(JSON.stringify(newStudySession[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating study session:", error);
    if (error instanceof z.ZodError) {
      
      return new Response(JSON.stringify({ error: error.errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ 
        error: "Failed to create study session", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function updateStudySession(req: ExpressRequest, id: string) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = req.body; // Express already parses JSON body
    const validatedData = insertStudySessionSchema.partial().parse(body);

    const updatedStudySession = await db
      .update(studySessions)
      .set({
        ...validatedData,
        updated_at: Math.floor(Date.now() / 1000),
      })
      .where(and(
        eq(studySessions.id, parseInt(id)),
        eq(studySessions.user_id, user.id)
      ))
      .returning();

    if (!updatedStudySession.length) {
      return new Response(JSON.stringify({ error: "Study session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(updatedStudySession[0]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating study session:", error);
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: error.errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ error: "Failed to update study session" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function deleteStudySession(req: ExpressRequest, id: string) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const deletedStudySession = await db
      .delete(studySessions)
      .where(and(
        eq(studySessions.id, parseInt(id)),
        eq(studySessions.user_id, user.id)
      ))
      .returning();

    if (!deletedStudySession.length) {
      return new Response(JSON.stringify({ error: "Study session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting study session:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete study session" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
} 