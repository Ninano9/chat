<template>
  <div class="register-container">
    <div class="register-card">
      <div class="register-header">
        <h1>💬 실시간 채팅</h1>
        <p>새 계정을 만들어 채팅을 시작하세요</p>
      </div>
      
      <form @submit.prevent="handleRegister" class="register-form">
        <div class="form-group">
          <label for="email" class="form-label">이메일</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            class="form-control"
            :class="{ error: errors.email }"
            placeholder="이메일을 입력하세요"
            required
          />
          <div v-if="errors.email" class="error-message">{{ errors.email }}</div>
        </div>
        
        <div class="form-group">
          <label for="nickname" class="form-label">닉네임</label>
          <input
            id="nickname"
            v-model="form.nickname"
            type="text"
            class="form-control"
            :class="{ error: errors.nickname }"
            placeholder="닉네임을 입력하세요"
            required
          />
          <div v-if="errors.nickname" class="error-message">{{ errors.nickname }}</div>
        </div>
        
        <div class="form-group">
          <label for="password" class="form-label">비밀번호</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            class="form-control"
            :class="{ error: errors.password }"
            placeholder="비밀번호를 입력하세요 (최소 6자)"
            required
          />
          <div v-if="errors.password" class="error-message">{{ errors.password }}</div>
        </div>
        
        <div class="form-group">
          <label for="confirmPassword" class="form-label">비밀번호 확인</label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            class="form-control"
            :class="{ error: errors.confirmPassword }"
            placeholder="비밀번호를 다시 입력하세요"
            required
          />
          <div v-if="errors.confirmPassword" class="error-message">{{ errors.confirmPassword }}</div>
        </div>
        
        <div v-if="authStore.error" class="alert alert-error">
          {{ authStore.error }}
        </div>
        
        <button
          type="submit"
          class="btn btn-primary register-btn"
          :disabled="authStore.isLoading"
        >
          <span v-if="authStore.isLoading">회원가입 중...</span>
          <span v-else>회원가입</span>
        </button>
      </form>
      
      <div class="register-footer">
        <p>
          이미 계정이 있으신가요?
          <router-link to="/login" class="link">로그인</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

const form = reactive({
  email: '',
  nickname: '',
  password: '',
  confirmPassword: ''
})

const errors = ref({})

const validateForm = () => {
  errors.value = {}
  
  if (!form.email) {
    errors.value.email = '이메일을 입력해주세요.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.value.email = '올바른 이메일 형식이 아닙니다.'
  }
  
  if (!form.nickname) {
    errors.value.nickname = '닉네임을 입력해주세요.'
  } else if (form.nickname.length < 2) {
    errors.value.nickname = '닉네임은 최소 2자 이상이어야 합니다.'
  } else if (form.nickname.length > 20) {
    errors.value.nickname = '닉네임은 최대 20자까지 입력할 수 있습니다.'
  }
  
  if (!form.password) {
    errors.value.password = '비밀번호를 입력해주세요.'
  } else if (form.password.length < 6) {
    errors.value.password = '비밀번호는 최소 6자 이상이어야 합니다.'
  }
  
  if (!form.confirmPassword) {
    errors.value.confirmPassword = '비밀번호 확인을 입력해주세요.'
  } else if (form.password !== form.confirmPassword) {
    errors.value.confirmPassword = '비밀번호가 일치하지 않습니다.'
  }
  
  return Object.keys(errors.value).length === 0
}

const handleRegister = async () => {
  if (!validateForm()) return
  
  const result = await authStore.register(form.email, form.password, form.nickname)
  
  if (result.success) {
    // 소켓 연결
    chatStore.initializeSocket()
    router.push('/chat')
  }
}
</script>

<style scoped>
.register-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0ebac7 0%, #0b65c2 100%);
  padding: 20px;
}

.register-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 400px;
}

.register-header {
  text-align: center;
  margin-bottom: 32px;
}

.register-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
}

.register-header p {
  color: #666;
  font-size: 16px;
}

.register-form {
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s ease;
}

.form-control:focus {
  outline: none;
  border-color: #0ebac7;
  box-shadow: 0 0 0 3px rgba(14, 186, 199, 0.1);
}

.form-control.error {
  border-color: #e74c3c;
}

.error-message {
  color: #e74c3c;
  font-size: 14px;
  margin-top: 4px;
}

.register-btn {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #0ebac7 0%, #0b65c2 100%);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.register-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(11, 101, 194, 0.35);
}

.register-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.register-footer {
  text-align: center;
  color: #666;
}

.link {
  color: #0b65c2;
  text-decoration: none;
  font-weight: 600;
}

.link:hover {
  text-decoration: underline;
}

.alert {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.alert-error {
  background-color: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

@media (max-width: 480px) {
  .register-card {
    padding: 24px;
    margin: 10px;
  }
  
  .register-header h1 {
    font-size: 24px;
  }
}
</style>

