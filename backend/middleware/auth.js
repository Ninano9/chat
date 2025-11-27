import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool } from '../database/db.js';

// JWT 토큰 생성
export const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

// JWT 토큰 검증 미들웨어
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: '액세스 토큰이 필요합니다.' 
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // 사용자 정보 조회
    const result = await pool.query(
      'SELECT id, email, nickname, profile_image FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: '유효하지 않은 토큰입니다.' 
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: '토큰이 만료되었습니다.' 
      });
    }
    
    return res.status(403).json({ 
      success: false, 
      message: '유효하지 않은 토큰입니다.' 
    });
  }
};

// WebSocket용 토큰 검증
export const authenticateSocketToken = async (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    
    const result = await pool.query(
      'SELECT id, email, nickname, profile_image FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    return result.rows[0];
  } catch (error) {
    throw new Error('토큰 인증에 실패했습니다.');
  }
};

