import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Setup Turso client
const tursoClient = createClient({
  url: "https://tiger-gadeba.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDQwNDYwNDQsImlhdCI6MTc0NDA0MjQ0NCwiaWQiOiIwMTNlZjlhNC1kN2RlLTQxYTMtOWE3My0yNGUyNTBhMWM4ODYiLCJyaWQiOiI3YTNiYmVmMy04NGVjLTQzZWEtYWIwOC1hNmE4ZWRhNDUxN2MifQ.DA8Zlej4RhMS5Xs-2_A-HAgmG7fJB4sWc3mDiJJBtJBpE1BateZYFyJUJfsW8J0V7lv1u3x5-lBR-WDrFPkNAQ",
});

async function testConnection() {
  console.log('🔍 Testing Turso database connection...');
  
  try {
    // Test getting SQLite version to verify connection
    const result = await tursoClient.execute({ sql: 'SELECT sqlite_version() as version;' });
    
    console.log('✅ Connection successful!');
    console.log(`📊 SQLite version: ${result.rows[0].version}`);
    
    // List all tables
    const tables = await tursoClient.execute({ 
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" 
    });
    
    console.log('📑 Tables in the database:');
    if (tables.rows.length === 0) {
      console.log('No tables found. You may need to run migrations first.');
    } else {
      tables.rows.forEach(row => console.log(` - ${row.name}`));
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error(error);
  }
}

testConnection(); 