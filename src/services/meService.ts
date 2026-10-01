import { apiRequest } from '@/services/httpClient'

export interface MyModuleAccess {
  id: string
  key: string
  name: string
  permission_codes: string[]
  /** The portal can open it directly (single sign-on handoff). */
  launchable: boolean
}

export interface HandoffStart {
  redirect_url: string
  expires_in: number
}

export const meService = {
  async myModules(): Promise<MyModuleAccess[]> {
    return (await apiRequest<MyModuleAccess[]>('/v1/me/modules')) ?? []
  },

  /** A one-time code for opening a module, as the URL to send the browser to. */
  async startHandoff(moduleKey: string): Promise<HandoffStart> {
    const response = await apiRequest<HandoffStart>('/v1/auth/handoff', {
      method: 'POST',
      body: JSON.stringify({ module_key: moduleKey }),
    })
    if (!response) throw new Error('Respuesta invalida del servidor')
    return response
  },
}
