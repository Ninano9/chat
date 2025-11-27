import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import './style.css'

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')

