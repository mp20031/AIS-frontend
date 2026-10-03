import { createApp } from 'vue'
import { autoAnimatePlugin } from '@formkit/auto-animate/vue'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import 'vue3-toastify/dist/index.css'

createApp(App).use(router).use(autoAnimatePlugin).mount('#app')
