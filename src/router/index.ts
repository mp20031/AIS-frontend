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
    // Entry point for opening a module: modules send unauthenticated users here.
    path: '/launch/:moduleKey',
    name: 'launch',
    component: () => import('@/views/LaunchView.vue'),
    meta: { requiresAuth: true },
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

  // Remember where they were going, so a module's "Entrar con IAM" comes back
  // to /launch/<module> after the login instead of stopping at the dashboard.
  if (to.meta.requiresAuth && !authenticated) {
    return { name: 'login', query: to.name === 'dashboard' ? {} : { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && authenticated) return { name: 'dashboard' }
  return true
})

export default router
