import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users, sessions } from '../../shared/schema';
import { eq, lt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createSession(userId: number): Promise<string> {
  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now in seconds

  await db.insert(sessions).values({
    id: sessionId,
    user_id: userId,
    expires_at: expiresAt,
  });

  return sessionId;
}

// Define a return type that includes both validation status and user info
export interface ValidationResult {
  isValid: boolean;
  userId?: number;
  userData?: {
    id: number;
    username: string;
    email: string;
    role?: string;
    lastLogin?: Date;
  };
  error?: string;
}

/**
 * Validates a session token and returns user information
 * @param sessionIdOrToken - Can be a session ID, Bearer token, or null if checking cookies
 * @param req - Optional Express request object for cookie-based auth
 * @returns ValidationResult with status and user information if valid
 */
export async function validateSession(
  sessionIdOrToken?: string | null, 
  req?: Request
): Promise<ValidationResult> {
  const result: ValidationResult = { isValid: false };
  const authLog = [];
  authLog.push('Session validation started');

  try {
    // Extract session ID from various sources
    let sessionId: string | null = null;
    
    // Try to get session from the provided token
    if (sessionIdOrToken) {
      // Handle if this is a Bearer token
      if (sessionIdOrToken.startsWith('Bearer ')) {
        sessionId = sessionIdOrToken.split(' ')[1].trim();
        authLog.push('Session ID extracted from Bearer token');
      } else {
        sessionId = sessionIdOrToken.trim();
        authLog.push('Using provided session ID directly');
      }
    }
    
    // Try to get session from cookies if req is provided and no token was found
    if (!sessionId && req?.cookies?.sessionId) {
      sessionId = req.cookies.sessionId;
      authLog.push('Session ID extracted from cookie');
    }
    
    // No session ID found in any source
    if (!sessionId) {
      authLog.push('No session ID found in request');
      result.error = 'No session identifier provided';
      return result;
    }
    
    // Validate session ID format (should be a hex string if created with randomBytes)
    if (!/^[0-9a-f]+$/i.test(sessionId)) {
      authLog.push('Malformed session ID - not a valid hex string');
      result.error = 'Malformed session token';
      return result;
    }
    
    authLog.push(`Validating session: ${sessionId.substring(0, 10)}...`);
    
    // Query the database for the session
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      authLog.push('Session not found in database');
      result.error = 'Session not found';
      return result;
    }

    // Check if the session has expired
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp > session.expires_at) {
      authLog.push(`Session expired at ${new Date(session.expires_at * 1000).toISOString()}`);
      // Clean up expired session
      await deleteSession(sessionId);
      result.error = 'Session expired';
      return result;
    }

    // Fetch user data for the valid session
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user_id),
      columns: {
        id: true,
        username: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!user) {
      authLog.push(`Associated user ID ${session.user_id} not found`);
      result.error = 'User associated with session not found';
      return result;
    }

    // If we get here, the session is valid
    authLog.push(`Valid session for user: ${user.username} (ID: ${user.id})`);
    result.isValid = true;
    result.userId = user.id;
    result.userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      lastLogin: new Date(session.created_at * 1000)
    };
    
    return result;
  } catch (error) {
    // Handle unexpected errors
    authLog.push(`Error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    result.error = 'Server error during session validation';
    return result;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    const result = await db.delete(sessions)
      .where(lt(sessions.expires_at, currentTimestamp))
      .returning({ id: sessions.id });
    
    return result.length;
  } catch (error) {
    return 0;
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try to authenticate using header Authorization first
    const authHeader = req.headers.authorization;
    let validationResult: ValidationResult;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Token-based authentication
      validationResult = await validateSession(authHeader);
    } else {
      // Cookie-based authentication
      validationResult = await validateSession(null, req);
    }
    
    // Handle validation result
    if (!validationResult.isValid) {
      return res.status(401).json({ error: validationResult.error || 'Authentication required' });
    }
    
    // Authentication successful
    req.userId = validationResult.userId;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Server error during authentication' });
  }
}; 
