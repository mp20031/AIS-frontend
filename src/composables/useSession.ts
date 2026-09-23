import { readonly, ref } from 'vue'
import router from '@/router'
import { authService, type UserInfo } from '@/services/authService'
import { ApiError } from '@/services/httpClient'

/**
 * The signed-in user, loaded once per app session and shared across components.
 *
 * Deliberately a module-level ref rather than per-component state: the sidebar,
 * the views and any future permission-gated control all need the same answer,
 * and each one calling `/v1/auth/userinfo` on its own would hit the API several
 * times for a value that cannot differ between them.
 */
const user = ref<UserInfo | null>(null)
const loading = ref(false)
const error = ref('')

async function load(force = false): Promise<void> {
  if (!authService.isAuthenticated()) return
  if (user.value && !force) return
  if (loading.value) return

  loading.value = true
  error.value = ''

  try {
    user.value = await authService.fetchUserInfo()
  } catch (err) {
    // A 401 here means the token is signed but the account behind it is gone
    // or deactivated. Keeping the shell on screen would show a session that no
    // longer exists, so the session is dropped instead.
    if (err instanceof ApiError && err.status === 401) {
      authService.logout()
      user.value = null
      await router.replace({ name: 'login' })
      return
    }
    error.value = err instanceof Error ? err.message : 'No se pudo cargar tu sesion'
  } finally {
    loading.value = false
  }
}

function clear(): void {
  user.value = null
  error.value = ''
}

/** True when the live account holds `code`. Gates UI only — the API re-checks. */
function can(code: string): boolean {
  return user.value?.permissions.includes(code) ?? false
}

export function useSession() {
  return {
    user: readonly(user),
    loading: readonly(loading),
    error: readonly(error),
    load,
    clear,
    can,
  }
}
