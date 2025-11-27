import express from 'express';
import { pool } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 채팅방 목록 조회
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(`
      SELECT 
        r.id,
        r.type,
        r.title,
        r.created_at,
        CASE 
          WHEN r.type = '1:1' THEN (
            SELECT u.nickname 
            FROM room_members rm2 
            JOIN users u ON rm2.user_id = u.id 
            WHERE rm2.room_id = r.id AND rm2.user_id != $1
            LIMIT 1
          )
          ELSE r.title
        END as display_name,
        CASE 
          WHEN r.type = '1:1' THEN (
            SELECT u.profile_image 
            FROM room_members rm2 
            JOIN users u ON rm2.user_id = u.id 
            WHERE rm2.room_id = r.id AND rm2.user_id != $1
            LIMIT 1
          )
          ELSE NULL
        END as display_image,
        (
          SELECT COUNT(*)
          FROM room_members rm3
          WHERE rm3.room_id = r.id
        ) as member_count,
        (
          SELECT m.content
          FROM messages m
          WHERE m.room_id = r.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT m.created_at
          FROM messages m
          WHERE m.room_id = r.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*)
          FROM messages m
          LEFT JOIN read_messages rm ON m.id = rm.message_id AND rm.user_id = $1
          WHERE m.room_id = r.id AND m.sender_id != $1 AND rm.message_id IS NULL
        ) as unread_count
      FROM rooms r
      JOIN room_members rm ON r.id = rm.room_id
      WHERE rm.user_id = $1
      ORDER BY last_message_time DESC NULLS LAST, r.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: {
        rooms: result.rows
      }
    });

  } catch (error) {
    console.error('채팅방 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 1:1 채팅방 생성 또는 기존 방 조회
router.post('/direct', authenticateToken, async (req, res) => {
  const { targetUserId } = req.body;
  const currentUserId = req.user.id;

  try {
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: '대상 사용자 ID가 필요합니다.'
      });
    }

    if (targetUserId == currentUserId) {
      return res.status(400).json({
        success: false,
        message: '자기 자신과는 채팅할 수 없습니다.'
      });
    }

    // 대상 사용자 존재 확인
    const targetUser = await pool.query(
      'SELECT id, nickname FROM users WHERE id = $1',
      [targetUserId]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 기존 1:1 채팅방 확인
    const existingRoom = await pool.query(`
      SELECT r.id, r.created_at
      FROM rooms r
      JOIN room_members rm1 ON r.id = rm1.room_id
      JOIN room_members rm2 ON r.id = rm2.room_id
      WHERE r.type = '1:1'
      AND rm1.user_id = $1
      AND rm2.user_id = $2
      AND (
        SELECT COUNT(*) FROM room_members rm3 WHERE rm3.room_id = r.id
      ) = 2
    `, [currentUserId, targetUserId]);

    if (existingRoom.rows.length > 0) {
      // 기존 방이 있으면 해당 방 정보 반환
      return res.json({
        success: true,
        message: '기존 채팅방을 찾았습니다.',
        data: {
          room: {
            id: existingRoom.rows[0].id,
            type: '1:1',
            display_name: targetUser.rows[0].nickname,
            created_at: existingRoom.rows[0].created_at
          }
        }
      });
    }

    // 새 1:1 채팅방 생성
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 방 생성
      const roomResult = await client.query(
        'INSERT INTO rooms (type) VALUES ($1) RETURNING id, created_at',
        ['1:1']
      );

      const room = roomResult.rows[0];

      // 참가자 추가
      await client.query(
        'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)',
        [room.id, currentUserId, targetUserId]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: '1:1 채팅방이 생성되었습니다.',
        data: {
          room: {
            id: room.id,
            type: '1:1',
            display_name: targetUser.rows[0].nickname,
            created_at: room.created_at
          }
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('1:1 채팅방 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 그룹 채팅방 생성
router.post('/group', authenticateToken, async (req, res) => {
  const { title, memberIds } = req.body;
  const currentUserId = req.user.id;

  try {
    if (!title || !memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({
        success: false,
        message: '방 제목과 참가자 목록이 필요합니다.'
      });
    }

    if (memberIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: '그룹 채팅방은 최소 3명 이상이어야 합니다.'
      });
    }

    // 모든 참가자 (현재 사용자 포함)
    const allMemberIds = [currentUserId, ...memberIds.filter(id => id != currentUserId)];

    // 참가자 존재 확인
    const membersResult = await pool.query(
      'SELECT id, nickname FROM users WHERE id = ANY($1)',
      [allMemberIds]
    );

    if (membersResult.rows.length !== allMemberIds.length) {
      return res.status(400).json({
        success: false,
        message: '존재하지 않는 사용자가 포함되어 있습니다.'
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 그룹 채팅방 생성
      const roomResult = await client.query(
        'INSERT INTO rooms (type, title) VALUES ($1, $2) RETURNING id, created_at',
        ['group', title]
      );

      const room = roomResult.rows[0];

      // 참가자들 추가
      const memberValues = allMemberIds.map((_, index) => `($1, $${index + 2})`).join(', ');
      const memberQuery = `INSERT INTO room_members (room_id, user_id) VALUES ${memberValues}`;
      
      await client.query(memberQuery, [room.id, ...allMemberIds]);

      // 시스템 메시지 추가
      const memberNames = membersResult.rows.map(user => user.nickname).join(', ');
      await client.query(
        'INSERT INTO messages (room_id, sender_id, type, content) VALUES ($1, $2, $3, $4)',
        [room.id, currentUserId, 'system', `${req.user.nickname}님이 ${memberNames}님을 초대했습니다.`]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: '그룹 채팅방이 생성되었습니다.',
        data: {
          room: {
            id: room.id,
            type: 'group',
            title: title,
            created_at: room.created_at,
            members: membersResult.rows
          }
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('그룹 채팅방 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 특정 채팅방 정보 조회
router.get('/:roomId', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  try {
    // 사용자가 해당 방의 멤버인지 확인
    const memberCheck = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: '해당 채팅방에 접근할 권한이 없습니다.'
      });
    }

    // 채팅방 정보 조회
    const roomResult = await pool.query(`
      SELECT 
        r.id,
        r.type,
        r.title,
        r.created_at,
        CASE 
          WHEN r.type = '1:1' THEN (
            SELECT u.nickname 
            FROM room_members rm2 
            JOIN users u ON rm2.user_id = u.id 
            WHERE rm2.room_id = r.id AND rm2.user_id != $1
            LIMIT 1
          )
          ELSE r.title
        END as display_name
      FROM rooms r
      WHERE r.id = $2
    `, [userId, roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '채팅방을 찾을 수 없습니다.'
      });
    }

    // 채팅방 멤버 조회
    const membersResult = await pool.query(`
      SELECT u.id, u.nickname, u.profile_image, rm.joined_at
      FROM room_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.room_id = $1
      ORDER BY rm.joined_at
    `, [roomId]);

    const room = roomResult.rows[0];
    room.members = membersResult.rows;

    res.json({
      success: true,
      data: {
        room
      }
    });

  } catch (error) {
    console.error('채팅방 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

export default router;

