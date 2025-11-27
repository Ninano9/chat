<template>
  <div class="chat-container">
    <div class="sidebar" :class="{ 'sidebar-mobile-open': isSidebarOpen }">
      <div class="sidebar-header">
        <div class="user-profile">
          <div class="user-avatar">
            {{ authStore.user?.nickname?.charAt(0).toUpperCase() }}
          </div>
          <div class="user-info">
            <div class="user-name">{{ authStore.user?.nickname }}</div>
            <div class="user-status">온라인</div>
          </div>
        </div>
        <div class="sidebar-actions">
          <button @click="showNewChatModal = true" class="btn-icon" title="새 채팅">
            ➕
          </button>
          <button @click="handleLogout" class="btn-icon" title="로그아웃">
            🚪
          </button>
        </div>
      </div>
      
      <div class="room-list">
        <div v-if="chatStore.isLoading" class="loading-rooms">
          채팅방을 불러오는 중...
        </div>
        <div v-else-if="chatStore.sortedRooms.length === 0" class="empty-rooms">
          <p>아직 채팅방이 없습니다.</p>
          <p>새 채팅을 시작해보세요!</p>
        </div>
        <div
          v-for="room in chatStore.sortedRooms"
          :key="room.id"
          class="room-item"
          :class="{ active: chatStore.currentRoom?.id === room.id }"
          @click="selectRoom(room)"
        >
          <div class="room-avatar">
            {{ room.display_name?.charAt(0).toUpperCase() }}
          </div>
          <div class="room-info">
            <div class="room-name">{{ room.display_name || room.title }}</div>
            <div class="room-last-message">
              {{ room.last_message || '메시지가 없습니다.' }}
            </div>
          </div>
          <div class="room-meta">
            <div v-if="room.last_message_time" class="room-time">
              {{ formatTime(room.last_message_time) }}
            </div>
            <div v-if="room.unread_count > 0" class="unread-badge">
              {{ room.unread_count }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="chat-main">
      <!-- 모바일 헤더 -->
      <div class="mobile-header">
        <button @click="toggleSidebar" class="btn-icon">
          ☰
        </button>
        <div v-if="chatStore.currentRoom" class="current-room-info">
          <div class="room-name">{{ chatStore.currentRoom.display_name || chatStore.currentRoom.title }}</div>
        </div>
      </div>
      
      <!-- 채팅 영역 -->
      <div v-if="!chatStore.currentRoom" class="no-room-selected">
        <div class="welcome-message">
          <h2>💬 실시간 채팅에 오신 것을 환영합니다!</h2>
          <p>왼쪽에서 채팅방을 선택하거나 새 채팅을 시작해보세요.</p>
        </div>
      </div>
      
      <div v-else class="chat-area">
        <!-- 채팅 헤더 -->
        <div class="chat-header">
          <div class="chat-room-info">
            <div class="room-avatar">
              {{ chatStore.currentRoom.display_name?.charAt(0).toUpperCase() }}
            </div>
            <div>
              <div class="room-name">{{ chatStore.currentRoom.display_name || chatStore.currentRoom.title }}</div>
              <div class="room-members">
                {{ chatStore.currentRoom.type === '1:1' ? '1:1 채팅' : `그룹 채팅 (${chatStore.currentRoom.member_count}명)` }}
              </div>
            </div>
            <div class="chat-actions">
              <button class="leave-button" @click="confirmLeaveRoom">
                채팅방 삭제
              </button>
            </div>
          </div>
        </div>
        
        <!-- 메시지 목록 -->
        <div ref="messagesContainer" class="messages-container">
          <div v-if="chatStore.messages.length === 0" class="empty-messages">
            <p>아직 메시지가 없습니다.</p>
            <p>첫 번째 메시지를 보내보세요!</p>
          </div>
          
          <div
            v-for="message in chatStore.messages"
            :key="message.id"
            class="message"
            :class="{ 'message-mine': message.sender?.id === authStore.user?.id }"
          >
            <div v-if="message.type === 'system'" class="system-message">
              {{ message.content }}
            </div>
            <div v-else class="message-content">
              <div v-if="message.sender?.id !== authStore.user?.id" class="message-sender">
                {{ message.sender?.nickname }}
              </div>
              <div class="message-bubble">
                <div class="message-text">{{ message.content }}</div>
                <div class="message-time">
                  {{ formatMessageTime(message.createdAt || message.created_at) }}
                  <span v-if="message.sender?.id === authStore.user?.id && message.readCount" class="read-count">
                    읽음 {{ message.readCount }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 타이핑 표시 -->
          <div v-if="typingText" class="typing-indicator">
            {{ typingText }}
          </div>
        </div>
        
        <!-- 메시지 입력 -->
        <div class="message-input-container">
          <div class="message-input">
            <input
              v-model="newMessage"
              type="text"
              placeholder="메시지를 입력하세요..."
              @keypress.enter="sendMessage"
              @input="handleTyping"
              class="message-input-field"
            />
            <button
              @click="sendMessage"
              :disabled="!newMessage.trim()"
              class="send-button"
            >
              📤
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 새 채팅 모달 -->
    <div v-if="showNewChatModal" class="modal-overlay" @click="closeNewChatModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <div class="modal-tabs">
            <button
              :class="['modal-tab', { active: modalMode === 'direct' }]"
              @click="switchModalMode('direct')"
            >
              1:1 채팅
            </button>
            <button
              :class="['modal-tab', { active: modalMode === 'group' }]"
              @click="switchModalMode('group')"
            >
              그룹 채팅
            </button>
          </div>
          <button @click="closeNewChatModal" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="modalMode === 'group'" class="group-form">
            <label class="form-label">그룹 제목</label>
            <input
              v-model="groupTitle"
              type="text"
              placeholder="그룹 이름을 입력하세요"
              class="form-control"
            />
            <div class="selected-members" v-if="selectedMembers.length">
              <span
                class="member-chip"
                v-for="member in selectedMembers"
                :key="member.id"
              >
                {{ member.nickname }}
                <button @click="toggleMemberSelection(member)">✕</button>
              </span>
            </div>
          </div>

          <div class="search-section">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="사용자 검색..."
              @input="searchUsers"
              class="form-control"
            />
          </div>
          
          <div v-if="searchResults.length > 0" class="search-results">
            <div
              v-for="user in searchResults"
              :key="user.id"
              class="user-item"
              @click="modalMode === 'direct' ? startDirectChat(user) : toggleMemberSelection(user)"
            >
              <div class="user-avatar">{{ user.nickname.charAt(0).toUpperCase() }}</div>
              <div class="user-info">
                <div class="user-name">{{ user.nickname }}</div>
                <div class="user-email">{{ user.email }}</div>
              </div>
              <div
                v-if="modalMode === 'group'"
                class="checkbox"
                :class="{ checked: selectedMembers.some(member => member.id === user.id) }"
              ></div>
            </div>
          </div>
          
  <div v-else-if="searchQuery && !isSearching" class="no-results">
            검색 결과가 없습니다.
          </div>

          <div v-if="modalMode === 'group'" class="modal-footer">
            <div class="error-message" v-if="modalError">{{ modalError }}</div>
            <button
              class="btn btn-primary"
              :disabled="isCreatingGroup"
              @click="createGroupChat"
            >
              {{ isCreatingGroup ? '생성 중...' : '그룹 채팅 생성' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

// 반응형 상태
const isSidebarOpen = ref(false)
const showNewChatModal = ref(false)
const newMessage = ref('')
const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
const messagesContainer = ref(null)
const typingTimer = ref(null)
const modalMode = ref('direct')
const groupTitle = ref('')
const selectedMembers = ref([])
const modalError = ref('')
const isCreatingGroup = ref(false)

// 컴퓨티드
const typingText = computed(() => {
  if (chatStore.typingUsers.length === 0) return ''
  
  const names = chatStore.typingUsers.map(u => u.nickname)
  if (names.length === 1) {
    return `${names[0]}님이 입력 중...`
  } else if (names.length === 2) {
    return `${names[0]}님과 ${names[1]}님이 입력 중...`
  } else {
    return `${names.length}명이 입력 중...`
  }
})

// 메서드
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const handleLogout = () => {
  chatStore.disconnectSocket()
  authStore.logout()
  router.push('/login')
}

const selectRoom = async (room) => {
  await chatStore.setCurrentRoom(room)
  isSidebarOpen.value = false
  scrollToBottom()
}

const sendMessage = () => {
  if (!newMessage.value.trim() || !chatStore.currentRoom) return
  
  chatStore.sendMessage(chatStore.currentRoom.id, newMessage.value.trim())
  newMessage.value = ''
  
  // 타이핑 중지
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
    typingTimer.value = null
  }
  chatStore.stopTyping(chatStore.currentRoom.id)
}

const handleTyping = () => {
  if (!chatStore.currentRoom) return
  
  // 타이핑 시작
  chatStore.startTyping(chatStore.currentRoom.id)
  
  // 3초 후 타이핑 중지
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }
  
  typingTimer.value = setTimeout(() => {
    chatStore.stopTyping(chatStore.currentRoom.id)
  }, 3000)
}

const searchUsers = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  
  isSearching.value = true
  const results = await chatStore.searchUsers(searchQuery.value.trim())
  searchResults.value = results || []
  isSearching.value = false
}

const startDirectChat = async (user) => {
  const room = await chatStore.createDirectRoom(user.id)
  if (room) {
    await chatStore.setCurrentRoom(room)
    closeNewChatModal()
  }
}

const toggleMemberSelection = (user) => {
  const exists = selectedMembers.value.find(member => member.id === user.id)
  if (exists) {
    selectedMembers.value = selectedMembers.value.filter(member => member.id !== user.id)
  } else {
    selectedMembers.value = [...selectedMembers.value, user]
  }
}

const createGroupChat = async () => {
  modalError.value = ''
  if (!groupTitle.value.trim()) {
    modalError.value = '그룹 제목을 입력해주세요.'
    return
  }
  if (selectedMembers.value.length < 2) {
    modalError.value = '최소 두 명 이상을 선택해야 합니다.'
    return
  }
  try {
    isCreatingGroup.value = true
    const room = await chatStore.createGroupRoom(
      groupTitle.value.trim(),
      selectedMembers.value.map(member => member.id)
    )
    if (room) {
      await chatStore.setCurrentRoom(room)
      closeNewChatModal()
    }
  } finally {
    isCreatingGroup.value = false
  }
}

const switchModalMode = (mode) => {
  modalMode.value = mode
  modalError.value = ''
  selectedMembers.value = []
  searchResults.value = []
  searchQuery.value = ''
  groupTitle.value = ''
}

const closeNewChatModal = () => {
  showNewChatModal.value = false
  searchQuery.value = ''
  searchResults.value = []
  selectedMembers.value = []
  groupTitle.value = ''
  modalError.value = ''
  modalMode.value = 'direct'
  isCreatingGroup.value = false
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) { // 1분 미만
    return '방금'
  } else if (diff < 3600000) { // 1시간 미만
    return `${Math.floor(diff / 60000)}분 전`
  } else if (diff < 86400000) { // 24시간 미만
    return `${Math.floor(diff / 3600000)}시간 전`
  } else {
    return date.toLocaleDateString()
  }
}

const formatMessageTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const confirmLeaveRoom = async () => {
  if (!chatStore.currentRoom) return
  const isGroup = chatStore.currentRoom.type === 'group'
  const message = isGroup
    ? '이 그룹 채팅을 나가시겠습니까?'
    : '채팅방을 삭제하면 기존 대화를 다시 볼 수 없습니다. 계속하시겠습니까?'

  if (!window.confirm(message)) return

  const result = await chatStore.leaveRoom(chatStore.currentRoom.id)
  if (!result.success) {
    alert(result.message || '채팅방을 삭제할 수 없습니다.')
    return
  }

  await chatStore.fetchRooms()
}

// 라이프사이클
onMounted(async () => {
  await chatStore.fetchRooms()
})

onUnmounted(() => {
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }
})

// 메시지 변경 감지하여 스크롤
watch(() => chatStore.messages.length, () => {
  scrollToBottom()
})

// 현재 방 변경 감지하여 스크롤
watch(() => chatStore.currentRoom, () => {
  scrollToBottom()
})
</script>

<style scoped>
.chat-container {
  display: flex;
  min-height: 100vh;
  background-color: #f5f5f5;
}

/* 사이드바 */
.sidebar {
  width: 320px;
  background: white;
  border-right: 1px solid #e1e5e9;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #e1e5e9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.user-info {
  flex: 1;
}

.user-name {
  font-weight: 600;
  color: #333;
}

.user-status {
  font-size: 12px;
  color: #28a745;
}

.sidebar-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 36px;
  height: 36px;
  border: none;
  background: #f8f9fa;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background: #e9ecef;
}

.room-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.loading-rooms,
.empty-rooms {
  padding: 40px 20px;
  text-align: center;
  color: #666;
}

.room-item {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f8f9fa;
}

.room-item:hover {
  background-color: #f8f9fa;
}

.room-item.active {
  background-color: #e3f2fd;
  border-right: 3px solid #2196f3;
}

.room-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.room-info {
  flex: 1;
  min-width: 0;
}

.room-name {
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-last-message {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.room-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.room-time {
  font-size: 12px;
  color: #999;
}

.unread-badge {
  background: #ff4757;
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  text-align: center;
}

/* 메인 채팅 영역 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  height: 100vh;
}

.mobile-header {
  display: none;
  padding: 16px 20px;
  border-bottom: 1px solid #e1e5e9;
  align-items: center;
  gap: 16px;
  background: white;
}

.current-room-info .room-name {
  font-weight: 600;
  color: #333;
}

.no-room-selected {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

.welcome-message {
  text-align: center;
  color: #666;
}

.welcome-message h2 {
  margin-bottom: 16px;
  color: #333;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-header {
  padding: 20px;
  border-bottom: 1px solid #e1e5e9;
  background: white;
}

.chat-room-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-actions {
  margin-left: auto;
}

.leave-button {
  border: 1px solid #ff6b6b;
  background: transparent;
  color: #ff6b6b;
  padding: 8px 14px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.leave-button:hover {
  background: #ff6b6b;
  color: #fff;
}

.room-members {
  font-size: 14px;
  color: #666;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f8f9fa;
  min-height: 0;
}

.empty-messages {
  text-align: center;
  color: #666;
  padding: 40px 20px;
}

.message {
  margin-bottom: 16px;
}

.message-mine {
  display: flex;
  justify-content: flex-end;
}

.system-message {
  text-align: center;
  color: #666;
  font-size: 14px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  margin: 8px 0;
}

.message-content {
  max-width: 70%;
}

.message-mine .message-content {
  margin-left: auto;
}

.message-sender {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  margin-left: 12px;
}

.message-bubble {
  background: white;
  border-radius: 18px;
  padding: 12px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  position: relative;
}

.message-mine .message-bubble {
  background: #007bff;
  color: white;
}

.message-text {
  word-wrap: break-word;
  line-height: 1.4;
}

.message-time {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.read-count {
  font-size: 10px;
}

.typing-indicator {
  color: #666;
  font-style: italic;
  font-size: 14px;
  padding: 8px 16px;
}

.message-input-container {
  padding: 20px;
  border-top: 1px solid #e1e5e9;
  background: white;
}

.message-input {
  display: flex;
  gap: 12px;
  align-items: center;
}

.message-input-field {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #e1e5e9;
  border-radius: 24px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.message-input-field:focus {
  border-color: #007bff;
}

.send-button {
  width: 44px;
  height: 44px;
  border: none;
  background: #007bff;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.send-button:hover:not(:disabled) {
  background: #0056b3;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 모달 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #e1e5e9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-tabs {
  display: flex;
  gap: 8px;
}

.modal-tab {
  border: none;
  background: #f1f3f5;
  padding: 8px 16px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
  color: #495057;
  transition: all 0.2s ease;
}

.modal-tab.active {
  background: #007bff;
  color: #fff;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.group-form {
  margin-bottom: 16px;
}

.selected-members {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.member-chip {
  background: #e7f1ff;
  color: #0d6efd;
  padding: 4px 8px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.member-chip button {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.search-section {
  margin-bottom: 20px;
}

.search-results {
  max-height: 300px;
  overflow-y: auto;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.user-item:hover {
  background: #f8f9fa;
}

.checkbox {
  margin-left: auto;
  width: 16px;
  height: 16px;
  border: 2px solid #ced4da;
  border-radius: 4px;
}

.checkbox.checked {
  background: #0d6efd;
  border-color: #0d6efd;
}

.user-email {
  font-size: 12px;
  color: #666;
}

.no-results {
  text-align: center;
  color: #666;
  padding: 40px 20px;
}

.modal-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.modal-footer .btn {
  min-width: 150px;
}

/* 반응형 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: -320px;
    height: 100vh;
    z-index: 100;
    transition: left 0.3s ease;
  }
  
  .sidebar-mobile-open {
    left: 0;
  }
  
  .mobile-header {
    display: flex;
  }
  
  .message-content {
    max-width: 85%;
  }
  
  .modal {
    width: 95%;
    margin: 20px;
  }
}

@media (max-width: 480px) {
  .messages-container {
    padding: 12px;
  }
  
  .message-input-container {
    padding: 12px;
  }
  
  .chat-header {
    padding: 16px;
  }
}
</style>

