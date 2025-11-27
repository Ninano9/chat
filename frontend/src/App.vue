<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const authStore = useAuthStore()
const chatStore = useChatStore()

onMounted(async () => {
  // 토큰이 있으면 사용자 정보 조회
  if (authStore.token) {
    await authStore.fetchUser()
    
    // 인증된 사용자면 소켓 연결
    if (authStore.isAuthenticated) {
      chatStore.initializeSocket()
    }
  }
})
</script>

<style scoped>
#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
