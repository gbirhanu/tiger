import { Request, Response, NextFunction } from 'express';
import { db } from '../../shared/db';
import { sessions } from '../../shared/schema';
import { eq } from 'drizzle-orm';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionId = authHeader.split(' ')[1];

    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!session || new Date(session.expires_at) < new Date()) {
      res.clearCookie('sessionId');
      return res.status(401).json({ error: 'Session expired' });
    }

    req.userId = session.user_id;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
} 