import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { testConnection, initializeDatabase } from './database/db.js';
import { initializeSocket } from './socket/socketHandler.js';

// 라우터 import
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import roomRoutes from './routes/rooms.js';
import messageRoutes from './routes/messages.js';

const app = express();
const server = createServer(app);

// CORS 설정
const corsOptions = {
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// 미들웨어 설정
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100 요청
  message: {
    success: false,
    message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.'
  }
});

app.use('/api', limiter);

// 라우터 설정
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '채팅 애플리케이션 API 서버',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      rooms: '/api/rooms',
      messages: '/api/messages'
    }
  });
});

// 404 에러 처리
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '요청한 엔드포인트를 찾을 수 없습니다.'
  });
});

// 전역 에러 처리
app.use((error, req, res, next) => {
  console.error('서버 에러:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: config.nodeEnv === 'production' 
      ? '서버 오류가 발생했습니다.' 
      : error.message
  });
});

// Socket.IO 초기화
const io = initializeSocket(server, corsOptions);

// 서버 시작
async function startServer() {
  try {
    // 데이터베이스 연결 테스트
    console.log('🔍 데이터베이스 연결 확인 중...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ 데이터베이스 연결에 실패했습니다. 서버를 시작할 수 없습니다.');
      process.exit(1);
    }

    // 데이터베이스 초기화
    console.log('🔧 데이터베이스 초기화 중...');
    await initializeDatabase();

    // 서버 시작
    server.listen(config.port, () => {
      console.log('🚀 채팅 서버가 시작되었습니다!');
      console.log(`📍 서버 주소: http://localhost:${config.port}`);
      console.log(`🌍 환경: ${config.nodeEnv}`);
      console.log(`🔗 CORS 허용 도메인: ${config.cors.origin}`);
      console.log('='.repeat(50));
    });

  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 서버 종료 신호를 받았습니다.');
  server.close(() => {
    console.log('✅ 서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 서버 종료 신호를 받았습니다.');
  server.close(() => {
    console.log('✅ 서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});

// 서버 시작
startServer();

