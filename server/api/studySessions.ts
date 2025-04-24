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
    const body = req.body; 
    const validatedData = insertStudySessionSchema.partial().parse(body);
    
    // Prepare the data to be set, explicitly handling 'completed'
    const updatePayload: { [key: string]: any } = {
      // Spread other validated fields first
      ...validatedData,
      // Always set updated_at
      updated_at: Math.floor(Date.now() / 1000),
    };
    
    // Force 'completed' to the correct integer value (1 for true, 0 for false)
    // if it was present in the validated data.
    if (validatedData.completed !== undefined) {
      updatePayload.completed = validatedData.completed ? 1 : 0; 
    }

    // Log the payload right before the database call
    // console.log(`[updateStudySession] Updating session ID ${id} for user ${user.id} with payload:`, JSON.stringify(updatePayload)); // Removed log

    const updatedStudySession = await db
      .update(studySessions)
      .set(updatePayload) 
      .where(and(
        eq(studySessions.id, parseInt(id)),
        eq(studySessions.user_id, user.id)
      ))
      .returning();
      
    // Log the result after the database call
    if (updatedStudySession.length > 0) {
      // console.log(`[updateStudySession] Successfully updated session ID ${id}. Returned:`, JSON.stringify(updatedStudySession[0])); // Removed log
    } else {
      // console.log(`[updateStudySession] Update attempt for session ID ${id} returned no results (session not found or user mismatch).`); // Removed log
    }

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
    if (error instanceof z.ZodError) {
      // console.error("[updateStudySession] Validation Error:", error.errors); // Removed log
      return new Response(JSON.stringify({ error: error.errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    // console.error(`[updateStudySession] Error updating study session ID ${id}:`, error); // Removed log
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
    return new Response(
      JSON.stringify({ error: "Failed to delete study session" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
} 