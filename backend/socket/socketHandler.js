import { Server } from 'socket.io';
import { authenticateSocketToken } from '../middleware/auth.js';
import { pool } from '../database/db.js';

export const initializeSocket = (server, corsOptions) => {
  const io = new Server(server, {
    cors: corsOptions
  });

  // 연결된 사용자들을 저장할 Map
  const connectedUsers = new Map();

  // Socket 인증 미들웨어
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('토큰이 필요합니다.'));
      }

      const user = await authenticateSocketToken(token);
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('인증에 실패했습니다.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ 사용자 연결: ${socket.user.nickname} (${socket.user.id})`);
    
    // 연결된 사용자 정보 저장
    connectedUsers.set(socket.user.id, {
      socketId: socket.id,
      user: socket.user
    });

    // 사용자의 채팅방들에 조인
    joinUserRooms(socket);

    // 메시지 전송 이벤트
    socket.on('send_message', async (data) => {
      try {
        await handleSendMessage(socket, data, io);
      } catch (error) {
        console.error('메시지 전송 오류:', error);
        socket.emit('error', { message: '메시지 전송에 실패했습니다.' });
      }
    });

    // 메시지 읽음 처리 이벤트
    socket.on('mark_as_read', async (data) => {
      try {
        await handleMarkAsRead(socket, data, io);
      } catch (error) {
        console.error('읽음 처리 오류:', error);
      }
    });

    // 타이핑 상태 이벤트
    socket.on('typing_start', (data) => {
      socket.to(`room_${data.roomId}`).emit('user_typing', {
        userId: socket.user.id,
        nickname: socket.user.nickname,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      socket.to(`room_${data.roomId}`).emit('user_typing', {
        userId: socket.user.id,
        nickname: socket.user.nickname,
        isTyping: false
      });
    });

    // 연결 해제 이벤트
    socket.on('disconnect', () => {
      console.log(`❌ 사용자 연결 해제: ${socket.user.nickname} (${socket.user.id})`);
      connectedUsers.delete(socket.user.id);
    });
  });

  return io;
};

// 사용자의 모든 채팅방에 조인
async function joinUserRooms(socket) {
  try {
    const result = await pool.query(`
      SELECT r.id
      FROM rooms r
      JOIN room_members rm ON r.id = rm.room_id
      WHERE rm.user_id = $1
    `, [socket.user.id]);

    result.rows.forEach(room => {
      socket.join(`room_${room.id}`);
    });

    console.log(`📝 ${socket.user.nickname}님이 ${result.rows.length}개 채팅방에 조인했습니다.`);
  } catch (error) {
    console.error('채팅방 조인 오류:', error);
  }
}

// 메시지 전송 처리
async function handleSendMessage(socket, data, io) {
  const { roomId, content, type = 'text' } = data;
  const userId = socket.user.id;

  // 입력 데이터 검증
  if (!roomId || !content) {
    socket.emit('error', { message: '방 ID와 메시지 내용이 필요합니다.' });
    return;
  }

  // 사용자가 해당 방의 멤버인지 확인
  const memberCheck = await pool.query(
    'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
    [roomId, userId]
  );

  if (memberCheck.rows.length === 0) {
    socket.emit('error', { message: '해당 채팅방에 접근할 권한이 없습니다.' });
    return;
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 메시지 저장
    const messageResult = await client.query(`
      INSERT INTO messages (room_id, sender_id, type, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `, [roomId, userId, type, content]);

    const message = messageResult.rows[0];

    // 발신자는 자동으로 읽음 처리
    await client.query(`
      INSERT INTO read_messages (message_id, user_id)
      VALUES ($1, $2)
    `, [message.id, userId]);

    await client.query('COMMIT');

    // 전송할 메시지 데이터 구성
    const messageData = {
      id: message.id,
      roomId: parseInt(roomId),
      type,
      content,
      createdAt: message.created_at,
      sender: {
        id: socket.user.id,
        nickname: socket.user.nickname,
        profileImage: socket.user.profile_image
      },
      readCount: 1 // 발신자만 읽음
    };

    // 해당 채팅방의 모든 사용자에게 메시지 전송
    io.to(`room_${roomId}`).emit('new_message', messageData);

    console.log(`💬 메시지 전송: ${socket.user.nickname} -> 방 ${roomId}`);

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// 메시지 읽음 처리
async function handleMarkAsRead(socket, data, io) {
  const { messageId } = data;
  const userId = socket.user.id;

  // 메시지 존재 확인 및 방 멤버십 확인
  const messageResult = await pool.query(`
    SELECT m.room_id, m.sender_id
    FROM messages m
    JOIN room_members rm ON m.room_id = rm.room_id
    WHERE m.id = $1 AND rm.user_id = $2
  `, [messageId, userId]);

  if (messageResult.rows.length === 0) {
    return;
  }

  const message = messageResult.rows[0];

  // 자신이 보낸 메시지는 읽음 처리하지 않음
  if (message.sender_id === userId) {
    return;
  }

  // 읽음 처리
  await pool.query(`
    INSERT INTO read_messages (message_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (message_id, user_id) DO NOTHING
  `, [messageId, userId]);

  // 읽음 수 업데이트를 해당 방의 모든 사용자에게 알림
  const readCountResult = await pool.query(
    'SELECT COUNT(*) FROM read_messages WHERE message_id = $1',
    [messageId]
  );

  io.to(`room_${message.room_id}`).emit('message_read', {
    messageId: parseInt(messageId),
    readCount: parseInt(readCountResult.rows[0].count),
    readBy: {
      id: userId,
      nickname: socket.user.nickname
    }
  });
}
