import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authService } from '@/services/authService'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    portalPadding?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true, portalPadding: true },
  },
  {
    path: '/seguridad',
    name: 'seguridad',
    component: () => import('@/views/SecurityView.vue'),
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const authenticated = authService.isAuthenticated()

  if (to.meta.requiresAuth && !authenticated) return { name: 'login' }
  if (to.meta.guestOnly && authenticated) return { name: 'dashboard' }
  return true
})

export default router
