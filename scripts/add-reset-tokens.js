import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Setup Turso client
const tursoClient = createClient({
  url: "https://tiger-gadeba.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDQwNDYwNDQsImlhdCI6MTc0NDA0MjQ0NCwiaWQiOiIwMTNlZjlhNC1kN2RlLTQxYTMtOWE3My0yNGUyNTBhMWM4ODYiLCJyaWQiOiI3YTNiYmVmMy04NGVjLTQzZWEtYWIwOC1hNmE4ZWRhNDUxN2MifQ.DA8Zlej4RhMS5Xs-2_A-HAgmG7fJB4sWc3mDiJJBtJBpE1BateZYFyJUJfsW8J0V7lv1u3x5-lBR-WDrFPkNAQ",
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, '..', 'migrations', '0201_add_reset_tokens.sql');

async function runMigration() {
  try {
    console.log('🐯 Tiger App - Adding Reset Tokens Table to Turso');
    console.log('📂 Connected to Turso database');
    
    // Read the migration file
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📝 Running migration...');
    
    // Check if the table already exists
    const checkResult = await tursoClient.execute({ 
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='reset_tokens';" 
    });
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️ The reset_tokens table already exists.');
      
      // Drop the existing table and recreate it
      console.log('🔄 Dropping existing reset_tokens table...');
      await tursoClient.execute({ sql: 'DROP TABLE IF EXISTS reset_tokens;' });
      console.log('✅ Existing table dropped.');
    }
    
    // Enable foreign keys
    await tursoClient.execute({ sql: 'PRAGMA foreign_keys = ON;' });
    
    // Execute the migration
    await tursoClient.execute({ sql: migrationSQL });
    console.log('✅ Reset tokens table created successfully');
    
    // Verify the table was created
    const verifyResult = await tursoClient.execute({ 
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='reset_tokens';" 
    });
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Verified: reset_tokens table exists in the database');
    } else {
      console.error('❌ Verification failed: reset_tokens table was not created');
    }
    
    console.log('📊 Migration completed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration(); 