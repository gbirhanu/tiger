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

export async function validateSession(sessionId: string): Promise<number | null> {
  try {
    console.log(`Validating session: ${sessionId.substring(0, 10)}...`);
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      console.log('Session not found in database');
      return null;
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp > session.expires_at) {
      console.log(`Session expired at ${new Date(session.expires_at * 1000).toISOString()}`);
      // Clean up expired session
      await deleteSession(sessionId);
      return null;
    }

    console.log(`Valid session found for user ID: ${session.user_id}`);
    return session.user_id;
  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    console.log(`Cleaning up sessions that expired before ${new Date(currentTimestamp * 1000).toISOString()}`);
    
    const result = await db.delete(sessions)
      .where(lt(sessions.expires_at, currentTimestamp))
      .returning({ id: sessions.id });
    
    console.log(`Cleaned up ${result.length} expired sessions`);
    return result.length;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return 0;
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionId = authHeader.split(' ')[1];
    console.log(`Auth middleware: Received token ${sessionId.substring(0, 10)}...`);

    const userId = await validateSession(sessionId);
    if (!userId) {
      console.log('Auth middleware: Invalid or expired session');
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    console.log(`Auth middleware: Authenticated user ID: ${userId}`);
    req.userId = userId;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ error: 'Server error during authentication' });
  }
}; 
