import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { io } from 'socket.io-client'
import { useAuthStore } from './auth'

const normalizeMessage = (message, fallbackRoomId) => {
  if (!message) return null

  return {
    id: message.id,
    roomId: message.roomId || message.room_id || fallbackRoomId,
    type: message.type,
    content: message.content,
    createdAt: message.createdAt || message.created_at,
    sender: message.sender || (message.sender_id
      ? {
          id: message.sender_id,
          nickname: message.sender_nickname,
          profileImage: message.sender_profile_image
        }
      : null),
    readCount: message.readCount ?? message.read_count ?? 0
  }
}

export const useChatStore = defineStore('chat', () => {
  // State
  const socket = ref(null)
  const rooms = ref([])
  const currentRoom = ref(null)
  const messages = ref([])
  const users = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const typingUsers = ref([])

  // Getters
  const sortedRooms = computed(() => {
    return [...rooms.value].sort((a, b) => {
      const timeA = new Date(a.last_message_time || a.created_at)
      const timeB = new Date(b.last_message_time || b.created_at)
      return timeB - timeA
    })
  })

  const unreadCount = computed(() => {
    return rooms.value.reduce((total, room) => total + (room.unread_count || 0), 0)
  })

  // Actions
  const initializeSocket = () => {
    const authStore = useAuthStore()
    
    if (!authStore.token) return

    // 기존 연결이 있다면 정리
    if (socket.value) {
      socket.value.removeAllListeners()
      socket.value.disconnect()
      socket.value = null
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
    socket.value = io(socketUrl, {
      auth: {
        token: authStore.token
      }
    })

    // 소켓 이벤트 리스너
    socket.value.on('connect', () => {
      console.log('✅ Socket 연결 성공')
    })

    socket.value.on('disconnect', () => {
      console.log('❌ Socket 연결 해제')
    })

    socket.value.on('new_message', (messageData) => {
      handleNewMessage(messageData)
    })

    socket.value.on('message_read', (data) => {
      handleMessageRead(data)
    })

    socket.value.on('user_typing', (data) => {
      handleUserTyping(data)
    })

    socket.value.on('error', (error) => {
      console.error('Socket 오류:', error)
      error.value = error.message
    })
  }

  const disconnectSocket = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
  }

  const fetchRooms = async () => {
    try {
      isLoading.value = true
      const response = await axios.get('/api/rooms')
      
      if (response.data.success) {
        rooms.value = response.data.data.rooms
      }
    } catch (err) {
      error.value = err.response?.data?.message || '채팅방 목록을 불러오는데 실패했습니다.'
    } finally {
      isLoading.value = false
    }
  }

  const fetchMessages = async (roomId, page = 1) => {
    try {
      const response = await axios.get(`/api/messages/room/${roomId}?page=${page}&limit=50`)
      
      if (response.data.success) {
        const normalizedMessages = response.data.data.messages
          .map(message => normalizeMessage(message, roomId))
          .filter(Boolean)

        if (page === 1) {
          messages.value = normalizedMessages
        } else {
          messages.value = [...normalizedMessages, ...messages.value]
        }
        return response.data.data.pagination
      }
    } catch (err) {
      error.value = err.response?.data?.message || '메시지를 불러오는데 실패했습니다.'
    }
  }

  const sendMessage = (roomId, content, type = 'text') => {
    if (socket.value && socket.value.connected) {
      socket.value.emit('send_message', {
        roomId,
        content,
        type
      })
    }
  }

  const markAsRead = (messageId) => {
    if (socket.value && socket.value.connected) {
      socket.value.emit('mark_as_read', {
        messageId
      })
    }
  }

  const markAllAsRead = async (roomId) => {
    try {
      await axios.post(`/api/messages/room/${roomId}/read-all`)
      
      // 로컬 상태 업데이트
      const room = rooms.value.find(r => r.id === roomId)
      if (room) {
        room.unread_count = 0
      }
    } catch (err) {
      console.error('모든 메시지 읽음 처리 실패:', err)
    }
  }

  const searchUsers = async (query) => {
    try {
      const response = await axios.get(`/api/users/search?q=${encodeURIComponent(query)}`)
      
      if (response.data.success) {
        users.value = response.data.data.users
        return response.data.data.users
      }
    } catch (err) {
      error.value = err.response?.data?.message || '사용자 검색에 실패했습니다.'
      return []
    }
  }

  const createDirectRoom = async (targetUserId) => {
    try {
      const response = await axios.post('/api/rooms/direct', {
        targetUserId
      })
      
      if (response.data.success) {
        const room = response.data.data.room
        
        // 기존 방이면 목록에서 찾아서 업데이트, 새 방이면 추가
        const existingRoomIndex = rooms.value.findIndex(r => r.id === room.id)
        if (existingRoomIndex >= 0) {
          rooms.value[existingRoomIndex] = { ...rooms.value[existingRoomIndex], ...room }
        } else {
          rooms.value.unshift(room)
        }
        
        return room
      }
    } catch (err) {
      error.value = err.response?.data?.message || '1:1 채팅방 생성에 실패했습니다.'
      return null
    }
  }

  const createGroupRoom = async (title, memberIds) => {
    try {
      const response = await axios.post('/api/rooms/group', {
        title,
        memberIds
      })
      
      if (response.data.success) {
        const room = response.data.data.room
        room.member_count = room.members ? room.members.length : undefined
        rooms.value.unshift(room)
        return room
      }
    } catch (err) {
      error.value = err.response?.data?.message || '그룹 채팅방 생성에 실패했습니다.'
      return null
    }
  }

  const setCurrentRoom = async (room) => {
    currentRoom.value = room
    messages.value = []
    
    if (room) {
      await fetchMessages(room.id)
      await markAllAsRead(room.id)
    }
  }

  const startTyping = (roomId) => {
    if (socket.value && socket.value.connected) {
      socket.value.emit('typing_start', { roomId })
    }
  }

  const stopTyping = (roomId) => {
    if (socket.value && socket.value.connected) {
      socket.value.emit('typing_stop', { roomId })
    }
  }

  const leaveRoom = async (roomId) => {
    try {
      await axios.delete(`/api/rooms/${roomId}`)
      rooms.value = rooms.value.filter(room => room.id !== roomId)
      if (currentRoom.value && currentRoom.value.id === roomId) {
        currentRoom.value = null
        messages.value = []
      }
      return { success: true }
    } catch (err) {
      console.error('채팅방 나가기 실패:', err)
      return { success: false, message: err.response?.data?.message || '채팅방을 나갈 수 없습니다.' }
    }
  }

  // 이벤트 핸들러
  const handleNewMessage = (messageData) => {
    // 현재 보고 있는 방의 메시지면 메시지 목록에 추가
    const normalized = normalizeMessage(messageData)
    if (!normalized) return

    if (currentRoom.value && currentRoom.value.id === normalized.roomId) {
      messages.value.push(normalized)
      
      // 자동으로 읽음 처리 (자신이 보낸 메시지가 아닌 경우)
      const authStore = useAuthStore()
      if (normalized.sender && normalized.sender.id !== authStore.user.id) {
        markAsRead(normalized.id)
      }
    }
    
    // 방 목록 업데이트
    const room = rooms.value.find(r => r.id === normalized.roomId)
    if (room) {
      room.last_message = normalized.content
      room.last_message_time = normalized.createdAt
      
      // 현재 보고 있는 방이 아니면 읽지 않은 메시지 수 증가
      if (!currentRoom.value || currentRoom.value.id !== normalized.roomId) {
        const authStore = useAuthStore()
        if (normalized.sender && normalized.sender.id !== authStore.user.id) {
          room.unread_count = (room.unread_count || 0) + 1
        }
      }
    }
    
    // 방 목록 정렬 (최신 메시지가 있는 방이 위로)
    rooms.value.sort((a, b) => {
      const timeA = new Date(a.last_message_time || a.created_at)
      const timeB = new Date(b.last_message_time || b.created_at)
      return timeB - timeA
    })
  }

  const handleMessageRead = (data) => {
    // 메시지 읽음 수 업데이트
    const message = messages.value.find(m => m.id === data.messageId)
    if (message) {
      message.readCount = data.readCount
    }
  }

  const handleUserTyping = (data) => {
    if (!currentRoom.value || currentRoom.value.id !== data.roomId) {
      return
    }

    if (data.isTyping) {
      if (!typingUsers.value.find(u => u.userId === data.userId)) {
        typingUsers.value.push({
          userId: data.userId,
          nickname: data.nickname,
          roomId: data.roomId
        })
      }
    } else {
      typingUsers.value = typingUsers.value.filter(u => u.userId !== data.userId)
    }
    
    setTimeout(() => {
      typingUsers.value = typingUsers.value.filter(u => u.userId !== data.userId)
    }, 3000)
  }

  return {
    // State
    socket,
    rooms,
    currentRoom,
    messages,
    users,
    isLoading,
    error,
    typingUsers,
    
    // Getters
    sortedRooms,
    unreadCount,
    
    // Actions
    initializeSocket,
    disconnectSocket,
    fetchRooms,
    fetchMessages,
    sendMessage,
    markAsRead,
    markAllAsRead,
    searchUsers,
    createDirectRoom,
    createGroupRoom,
    setCurrentRoom,
    startTyping,
    stopTyping,
    leaveRoom
  }
})

