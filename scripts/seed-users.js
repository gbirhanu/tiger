import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables from .env
dotenv.config();

// Setup Turso client
const tursoClient = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function seedUsers() {
  try {
    console.log('🌱 Seeding users to Turso database');
    console.log(`📊 Connected to Turso database: ${process.env.TURSO_DATABASE_URL}`);
    
    // Enable foreign keys
    await tursoClient.execute({ sql: 'PRAGMA foreign_keys = ON;' });
    
    // Check if users already exist
    const existingUsers = await tursoClient.execute({
      sql: 'SELECT * FROM users WHERE email IN (?, ?)',
      args: ['user@example.com', 'admin@example.com']
    });
    
    if (existingUsers.rows.length > 0) {
      console.log('⚠️ Users already exist in the database. Skipping seed operation.');
      existingUsers.rows.forEach(user => {
        console.log(`- User found: ${user.email} (${user.role})`);
      });
      return;
    }
    
    // Create normal user
    const normalUser = {
      email: 'user@example.com',
      password: await hashPassword('password123'),
      name: 'Normal User',
      role: 'user',
      status: 'active',
      is_online: false,
      login_count: 0,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000)
    };
    
    // Create admin user
    const adminUser = {
      email: 'admin@example.com',
      password: await hashPassword('admin123'),
      name: 'Admin User',
      role: 'admin',
      status: 'active',
      is_online: false,
      login_count: 0,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000)
    };
    
    // Insert normal user
    await tursoClient.execute({
      sql: `INSERT INTO users 
        (email, password, name, role, status, is_online, login_count, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        normalUser.email,
        normalUser.password,
        normalUser.name,
        normalUser.role,
        normalUser.status,
        normalUser.is_online ? 1 : 0,
        normalUser.login_count,
        normalUser.created_at,
        normalUser.updated_at
      ]
    });
    console.log(`✅ Normal user created: ${normalUser.email}`);
    
    // Insert admin user
    await tursoClient.execute({
      sql: `INSERT INTO users 
        (email, password, name, role, status, is_online, login_count, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        adminUser.email,
        adminUser.password,
        adminUser.name,
        adminUser.role,
        adminUser.status,
        adminUser.is_online ? 1 : 0,
        adminUser.login_count,
        adminUser.created_at,
        adminUser.updated_at
      ]
    });
    console.log(`✅ Admin user created: ${adminUser.email}`);
    
    console.log('🚀 Users seeded successfully!');
    console.log(`
    Normal User:
    - Email: user@example.com
    - Password: password123
    
    Admin User:
    - Email: admin@example.com
    - Password: admin123
    `);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

seedUsers(); 