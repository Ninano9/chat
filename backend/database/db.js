import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// PostgreSQL 연결 풀 생성
export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: 20, // 최대 연결 수
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 데이터베이스 연결 테스트
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL 데이터베이스 연결 성공');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL 데이터베이스 연결 실패:', error.message);
    return false;
  }
};

// 데이터베이스 초기화 (테이블 생성)
export const initializeDatabase = async () => {
  const client = await pool.connect();
  
  try {
    // users 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nickname VARCHAR(100) NOT NULL,
        profile_image VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // rooms 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL CHECK (type IN ('1:1', 'group')),
        title VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // room_members 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS room_members (
        room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (room_id, user_id)
      )
    `);

    // messages 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'image', 'file', 'system')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // read_messages 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS read_messages (
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id)
      )
    `);

    // 인덱스 생성
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
    `);

    console.log('✅ 데이터베이스 테이블 초기화 완료');
    
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error.message);
    throw error;
  } finally {
    client.release();
  }
};
