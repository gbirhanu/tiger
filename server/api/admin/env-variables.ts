import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { db } from '../../../shared/db';
import { schema } from '../../../shared/db';

// Extended request interface with user property
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    [key: string]: any;
  };
  userId?: number; // Added from requireAuth middleware
}

/**
 * Handles GET requests to retrieve environment variables
 * Only accessible to admin users
 */
export async function GET(req: AuthenticatedRequest, res: Response) {
  try {
    // Check authentication and authorization
    
    // Extract user ID from session (preferably from requireAuth middleware)
    let userId = req.userId;
    
    // Fallback to user object if middleware didn't set userId
    if (!userId && req.user?.id) {
      userId = parseInt(req.user.id, 10);
    }
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    
    // Get the full user record
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    // Define paths to .env file
    const envPath = path.resolve(process.cwd(), '.env');

    // Read current environment file
    try {
        const envContent = await fs.readFile(envPath, 'utf-8');
      
      // Parse existing content
      const envVars = dotenv.parse(envContent);
      
      // Return only specific variables, never expose all variables
      return res.status(200).json({
        GOOGLE_CLIENT_ID: envVars.GOOGLE_CLIENT_ID || '',
        GOOGLE_CLIENT_SECRET: envVars.GOOGLE_CLIENT_SECRET || '',
        GEMINI_API_KEY: envVars.GEMINI_API_KEY || '',
        TURSO_DATABASE_URL: envVars.TURSO_DATABASE_URL || envVars.TURSO_URL || '',
        TURSO_AUTH_TOKEN: envVars.TURSO_AUTH_TOKEN || '',
      });
    } catch (error) {
      return res.status(500).json({ message: 'Error reading environment file' });
    }
  } catch (error) {
    return res.status(500).json({ 
      message: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
  }
}

/**
 * Handles POST requests to update environment variables
 * Only accessible to admin users
 */
export async function POST(req: AuthenticatedRequest, res: Response) {
  try {
    // Check authentication and authorization
    
    // Extract user ID from session (preferably from requireAuth middleware)
    let userId = req.userId;
    
    // Fallback to user object if middleware didn't set userId
    if (!userId && req.user?.id) {
      userId = parseInt(req.user.id, 10);
    }
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    
    // Get the full user record - convert string ID to number if needed
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    // Get environment variables from request body
    const { 
      GOOGLE_CLIENT_ID, 
      GOOGLE_CLIENT_SECRET, 
      GEMINI_API_KEY, 
      TURSO_URL, 
      TURSO_AUTH_TOKEN 
    } = req.body;

    // Define paths to .env and .env.production files
    const envPath = path.resolve(process.cwd(), '.env');
    const envProductionPath = path.resolve(process.cwd(), '.env.production');


    // Read current environment files
    let envContent;
    let envProductionContent;

    try {
      envContent = await fs.readFile(envPath, 'utf-8');
      envProductionContent = await fs.readFile(envProductionPath, 'utf-8');
    } catch (error) {
      return res.status(500).json({ message: 'Error reading environment files' });
    }

    // Parse existing content
    const envVars = dotenv.parse(envContent);
    const envProductionVars = dotenv.parse(envProductionContent);

    // Update variables if they exist
    if (GOOGLE_CLIENT_ID) {
      envVars.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
      envVars.VITE_GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
      envProductionVars.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
      envProductionVars.VITE_GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
    }

    if (GOOGLE_CLIENT_SECRET) {
      envVars.GOOGLE_CLIENT_SECRET = GOOGLE_CLIENT_SECRET;
      envProductionVars.GOOGLE_CLIENT_SECRET = GOOGLE_CLIENT_SECRET;
    }

    if (GEMINI_API_KEY) {
      envVars.GEMINI_API_KEY = GEMINI_API_KEY;
      envVars.VITE_GEMINI_API_KEY = GEMINI_API_KEY;
      envProductionVars.GEMINI_API_KEY = GEMINI_API_KEY;
      envProductionVars.VITE_GEMINI_API_KEY = GEMINI_API_KEY;
    }

    if (TURSO_URL) {
      // Check variable names used in env files
      if ('TURSO_DATABASE_URL' in envVars) {
        envVars.TURSO_DATABASE_URL = TURSO_URL;
        
      } 
      
      if ('TURSO_URL' in envVars) {
        envVars.TURSO_URL = TURSO_URL;
        
      }
      
      if ('TURSO_DATABASE_URL' in envProductionVars) {
        envProductionVars.TURSO_DATABASE_URL = TURSO_URL;
        
      } 
      
      if ('TURSO_URL' in envProductionVars) {
        envProductionVars.TURSO_URL = TURSO_URL;
        
      }
    }

    if (TURSO_AUTH_TOKEN) {
      envVars.TURSO_AUTH_TOKEN = TURSO_AUTH_TOKEN;
      envProductionVars.TURSO_AUTH_TOKEN = TURSO_AUTH_TOKEN;
    }

    // Convert the updated variables back to .env format
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const newEnvProductionContent = Object.entries(envProductionVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Write the updated content back to the files
    try {
      await fs.writeFile(envPath, newEnvContent);
      await fs.writeFile(envProductionPath, newEnvProductionContent);
    } catch (error) {
      return res.status(500).json({ message: 'Error writing environment files' });
    }

    // Return success response
    return res.status(200).json({ 
      message: 'Environment variables updated successfully',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error instanceof Error ? error.message : 'An unknown error occurred' 
    });
  }
}

//get GOOGLE_CLIENT_ID and return it
export async function GET_GOOGLE_CLIENT_ID(req: Request, res: Response) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = await fs.readFile(envPath, 'utf-8');

    const envVars = dotenv.parse(envContent);
    return res.status(200).json({ GOOGLE_CLIENT_ID: envVars.GOOGLE_CLIENT_ID });
  } catch (error) {
    return res.status(500).json({ message: 'Error reading environment file' });
  }
}
