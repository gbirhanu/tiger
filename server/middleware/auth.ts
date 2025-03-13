import { Request, Response, NextFunction } from 'express';
import { db } from '../lib/db';  // Updated path
import { sessions } from '../../shared/schema';  // Keep this path as is
import { eq, lt } from 'drizzle-orm';
import { logger } from '../../shared/logger';  // Already correct

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      session?: {
        id: string;
        user_id: number;
        expires_at: Date;
      };
    }
  }
}

/**
 * Validates a session token format
 * @param token Session token to validate
 * @returns boolean indicating if token has valid format
 */
function isValidTokenFormat(token: string): boolean {
  // Add token format validation logic here
  // Example: Check if token follows expected pattern or structure
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return false;
  }
  
  // Further validation can be added based on token format expectations
  // For example, if using a specific format like UUID:
  // return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token);
  
  return true;
}

/**
 * Middleware to cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const currentTimestamp = new Date();
    await db
      .delete(sessions)
      .where(lt(sessions.expires_at, currentTimestamp))
      .execute();
      
    logger.info('Expired sessions cleanup completed');
  } catch (error) {
    logger.error('Failed to cleanup expired sessions', { error });
  }
}

/**
 * Authentication middleware that validates user sessions
 * Handles both token-based (Authorization header) and cookie-based authentication
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let sessionId: string | null = null;

    
    // First check Authorization header for token-based auth
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      sessionId = authHeader.split(' ')[1];
      logger.debug('Auth using Bearer token');
    }
    
    // If no valid Authorization header, fall back to cookie-based auth
    if (!sessionId && req.cookies?.sessionId) {
      sessionId = req.cookies.sessionId;
      logger.debug('Auth using cookie');
    }
    
    // If still no sessionId found, return authentication error
    if (!sessionId || !isValidTokenFormat(sessionId)) {
      logger.warn('Authentication failed: No valid session token provided');
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'No valid authentication token provided'
      });
    }
    
    // Log session ID for debugging (redacted for security)
    logger.debug(`Validating session: ${sessionId.substring(0, 6)}...`);
    
    // Attempt to retrieve session from database
    const session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();
    
    // Handle case where session doesn't exist or is expired
    if (!session) {
      logger.warn('Authentication failed: Session not found', { sessionId: sessionId.substring(0, 6) });
      res.clearCookie('sessionId');
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Session not found' 
      });
    }
    
    // Check if session is expired
    const now = new Date();
    const expiryDate = new Date(session.expires_at);
    
    if (expiryDate < now) {
      logger.warn('Authentication failed: Session expired', { 
        sessionId: sessionId.substring(0, 6),
        expiredAt: expiryDate 
      });
      
      // Clean up expired session cookie
      res.clearCookie('sessionId');
      
      // Schedule cleanup of expired sessions
      cleanupExpiredSessions().catch(err => 
        logger.error('Failed to trigger session cleanup', { error: err })
      );
      
      return res.status(401).json({ 
        error: 'Session expired',
        details: 'Your session has expired, please login again'
      });
    }
    
    // Authentication successful, set request properties
    req.userId = session.user_id;
    req.session = {
      id: session.id,
      user_id: session.user_id,
      expires_at: expiryDate
    };
    
    logger.debug('Authentication successful', { userId: session.user_id });
    next();
  } catch (error) {
    // Handle unexpected errors
    logger.error('Auth middleware error', { error });
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'An unexpected error occurred during authentication'
    });
  }
}
