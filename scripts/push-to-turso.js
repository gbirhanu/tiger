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
const migrationPath = path.join(__dirname, '..', 'migrations', '0000_complete_schema_setup.sql');

async function runMigration() {
  try {
    console.log('🐯 Tiger App Database Migration to Turso');
    console.log('📂 Connected to Turso database');
    
    // Read the migration file
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📝 Running migration...');
    
    // Split the SQL into individual statements
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    // Enable foreign keys
    await tursoClient.execute({ sql: 'PRAGMA foreign_keys = ON;' });
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          await tursoClient.execute({ sql: statement + ';' });
          console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error) {
          console.error(`❌ Error executing statement ${i + 1}/${statements.length}:`, error.message);
          console.error(statement);
          // Continue with other statements even if one fails
        }
      }
    }
    
    console.log('📊 Database migration completed');
    console.log(`
    Tiger app is now set up with Turso! 🚀
    
    Next steps:
    1. Start the server: npm run dev
    2. Open your browser: http://localhost:3000
    3. Register a new account and start being productive!
    `);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration(); 