import { readFileSync } from 'fs';
import { join } from 'path';
import { Database } from 'better-sqlite3';

/**
 * Simple migration runner for Tiger app
 * 
 * Run with: node migrations/run_migration.js
 */

// Configure the database path
const DB_PATH = process.env.DB_PATH || './tiger.db';

console.log('🐯 Tiger App Database Setup');
console.log('---------------------------');
console.log(`Database path: ${DB_PATH}`);

try {
  // Create/connect to the SQLite database
  const db = new Database(DB_PATH);
  console.log('📂 Connected to database');
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Read the migration file
  const migrationPath = join(process.cwd(), 'migrations', '0000_complete_schema_setup.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf8');
  
  console.log('📝 Running migration...');
  
  // Execute the migration as a transaction
  db.exec('BEGIN TRANSACTION;');
  
  try {
    db.exec(migrationSQL);
    db.exec('COMMIT;');
    console.log('✅ Migration successful!');
  } catch (error) {
    db.exec('ROLLBACK;');
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
  
  // Close the database connection
  db.close();
  
  console.log('📊 Database is ready to use');
  console.log(`
  Tiger app is now set up! 🚀
  
  Next steps:
  1. Start the server: npm run dev
  2. Open your browser: http://localhost:3000
  3. Register a new account and start being productive!
  `);
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
} 