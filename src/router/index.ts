import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authService } from '@/services/authService'
import { useSession } from '@/composables/useSession'
import { SECURITY_ACCESS_PERMISSIONS } from '@/config/permissions'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    portalPadding?: boolean
    requiredPermissions?: readonly string[]
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
    meta: {
      guestOnly: true,
    },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: {
      requiresAuth: true,
      portalPadding: true,
    },
  },
  {
    path: '/launch/:moduleKey',
    name: 'launch',
    component: () => import('@/views/LaunchView.vue'),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/seguridad',
    name: 'seguridad',
    component: () => import('@/views/SecurityView.vue'),
    meta: {
      requiresAuth: true,
      requiredPermissions: SECURITY_ACCESS_PERMISSIONS,
    },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  let authenticated = authService.isAuthenticated()

  // Before sending someone to the login page (or away from it), check whether
  // the refresh cookie can bring their session back.
  if (!authenticated && (to.meta.requiresAuth || to.meta.guestOnly)) {
    authenticated = await authService.restoreSession()
  }

  if (to.meta.requiresAuth && !authenticated) {
    return {
      name: 'login',
      query:
        to.name === 'dashboard'
          ? {}
          : { redirect: to.fullPath },
    }
  }

  if (to.meta.guestOnly && authenticated) {
    return {
      name: 'dashboard',
    }
  }

  if (to.meta.requiredPermissions?.length) {
    const { load, can } = useSession()

    await load()

    const allowed = to.meta.requiredPermissions.some((permission) =>
      can(permission),
    )

    if (!allowed) {
      return {
        name: 'dashboard',
        query: {
          notice: 'security-permission',
        },
      }
    }
  }

  return true
})

export default router