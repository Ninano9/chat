import express from 'express';
import { pool } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 특정 채팅방의 메시지 목록 조회
router.get('/room/:roomId', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const userId = req.user.id;

  try {
    // 사용자가 해당 방의 멤버인지 확인
    const memberCheck = await pool.query(
      'SELECT cleared_at FROM room_members WHERE room_id = $1 AND user_id = $2 AND COALESCE(hidden, FALSE) = FALSE',
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: '해당 채팅방에 접근할 권한이 없습니다.'
      });
    }

    const clearedAt = memberCheck.rows[0].cleared_at;

    const offset = (page - 1) * limit;

    // 메시지 목록 조회 (최신순)
    const messagesResult = await pool.query(`
      SELECT 
        m.id,
        m.type,
        m.content,
        m.created_at,
        u.id as sender_id,
        u.nickname as sender_nickname,
        u.profile_image as sender_profile_image,
        (
          SELECT COUNT(*)
          FROM read_messages rm
          WHERE rm.message_id = m.id
        ) as read_count,
        (
          SELECT rm.read_at
          FROM read_messages rm
          WHERE rm.message_id = m.id AND rm.user_id = $2
        ) as is_read_by_me
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = $1
        AND ($5::timestamp IS NULL OR m.created_at > $5)
      ORDER BY m.created_at DESC
      LIMIT $3 OFFSET $4
    `, [roomId, userId, limit, offset, clearedAt]);

    // 메시지를 시간순으로 정렬 (오래된 것부터)
    const messages = messagesResult.rows.reverse();

    // 전체 메시지 수 조회
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM messages WHERE room_id = $1 AND ($2::timestamp IS NULL OR created_at > $2)',
      [roomId, clearedAt]
    );

    const totalMessages = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalMessages / limit);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalMessages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('메시지 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 메시지 읽음 처리
router.post('/:messageId/read', authenticateToken, async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  try {
    // 메시지 존재 확인 및 방 멤버십 확인
    const messageResult = await pool.query(`
      SELECT m.room_id, m.sender_id
      FROM messages m
      JOIN room_members rm ON m.room_id = rm.room_id
      WHERE m.id = $1 AND rm.user_id = $2 AND COALESCE(rm.hidden, FALSE) = FALSE
    `, [messageId, userId]);

    if (messageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '메시지를 찾을 수 없거나 접근 권한이 없습니다.'
      });
    }

    const message = messageResult.rows[0];

    // 자신이 보낸 메시지는 읽음 처리하지 않음
    if (message.sender_id === userId) {
      return res.json({
        success: true,
        message: '자신이 보낸 메시지입니다.'
      });
    }

    // 읽음 처리 (이미 읽은 경우 무시)
    await pool.query(`
      INSERT INTO read_messages (message_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (message_id, user_id) DO NOTHING
    `, [messageId, userId]);

    res.json({
      success: true,
      message: '메시지를 읽음 처리했습니다.'
    });

  } catch (error) {
    console.error('메시지 읽음 처리 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 채팅방의 모든 메시지 읽음 처리
router.post('/room/:roomId/read-all', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  try {
    // 사용자가 해당 방의 멤버인지 확인
    const memberCheck = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND COALESCE(hidden, FALSE) = FALSE',
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: '해당 채팅방에 접근할 권한이 없습니다.'
      });
    }

    // 해당 방의 모든 메시지를 읽음 처리 (자신이 보낸 메시지 제외)
    await pool.query(`
      INSERT INTO read_messages (message_id, user_id)
      SELECT m.id, $2
      FROM messages m
      WHERE m.room_id = $1 
      AND m.sender_id != $2
      AND NOT EXISTS (
        SELECT 1 FROM read_messages rm 
        WHERE rm.message_id = m.id AND rm.user_id = $2
      )
    `, [roomId, userId]);

    res.json({
      success: true,
      message: '모든 메시지를 읽음 처리했습니다.'
    });

  } catch (error) {
    console.error('모든 메시지 읽음 처리 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

export default router;

