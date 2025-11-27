import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const token = ref(localStorage.getItem('token'))
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  // Actions
  const login = async (email, password) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await axios.post('/api/auth/login', {
        email,
        password
      })

      if (response.data.success) {
        token.value = response.data.data.token
        user.value = response.data.data.user
        
        localStorage.setItem('token', token.value)
        
        // axios 기본 헤더 설정
        axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
        
        return { success: true }
      }
    } catch (err) {
      error.value = err.response?.data?.message || '로그인에 실패했습니다.'
      return { success: false, message: error.value }
    } finally {
      isLoading.value = false
    }
  }

  const register = async (email, password, nickname) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await axios.post('/api/auth/register', {
        email,
        password,
        nickname
      })

      if (response.data.success) {
        token.value = response.data.data.token
        user.value = response.data.data.user
        
        localStorage.setItem('token', token.value)
        
        // axios 기본 헤더 설정
        axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
        
        return { success: true }
      }
    } catch (err) {
      error.value = err.response?.data?.message || '회원가입에 실패했습니다.'
      return { success: false, message: error.value }
    } finally {
      isLoading.value = false
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    error.value = null
    
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
  }

  const fetchUser = async () => {
    if (!token.value) return

    try {
      const response = await axios.get('/api/auth/me')
      
      if (response.data.success) {
        user.value = response.data.data.user
      }
    } catch (err) {
      console.error('사용자 정보 조회 실패:', err)
      // 토큰이 유효하지 않으면 로그아웃
      if (err.response?.status === 401) {
        logout()
      }
    }
  }

  const updateProfile = async (nickname) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await axios.put('/api/auth/profile', {
        nickname
      })

      if (response.data.success) {
        user.value = response.data.data.user
        return { success: true }
      }
    } catch (err) {
      error.value = err.response?.data?.message || '프로필 업데이트에 실패했습니다.'
      return { success: false, message: error.value }
    } finally {
      isLoading.value = false
    }
  }

  // 초기화 시 토큰이 있으면 axios 헤더 설정
  if (token.value) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }

  return {
    // State
    user,
    token,
    isLoading,
    error,
    
    // Getters
    isAuthenticated,
    
    // Actions
    login,
    register,
    logout,
    fetchUser,
    updateProfile
  }
})

