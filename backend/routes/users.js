import express from 'express';
import { pool } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 사용자 검색
router.get('/search', authenticateToken, async (req, res) => {
  const { q } = req.query; // 검색어
  const currentUserId = req.user.id;

  try {
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '검색어를 입력해주세요.'
      });
    }

    const searchTerm = `%${q.trim()}%`;

    // 닉네임 또는 이메일로 사용자 검색 (자신 제외)
    const result = await pool.query(
      `SELECT id, email, nickname, profile_image 
       FROM users 
       WHERE (nickname ILIKE $1 OR email ILIKE $1) 
       AND id != $2 
       ORDER BY nickname
       LIMIT 20`,
      [searchTerm, currentUserId]
    );

    res.json({
      success: true,
      data: {
        users: result.rows
      }
    });

  } catch (error) {
    console.error('사용자 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 특정 사용자 정보 조회
router.get('/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, email, nickname, profile_image FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: {
        user: result.rows[0]
      }
    });

  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

export default router;

