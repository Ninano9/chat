import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'chat_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your-password'
  },
  
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000'
  },
  
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE || 10485760, // 10MB
    uploadPath: process.env.UPLOAD_PATH || './uploads'
  }
};

