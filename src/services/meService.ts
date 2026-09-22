import { apiRequest } from '@/services/httpClient'

export interface MyModuleAccess {
  id: string
  key: string
  name: string
  permission_codes: string[]
}

export const meService = {
  async myModules(): Promise<MyModuleAccess[]> {
    return (await apiRequest<MyModuleAccess[]>('/v1/me/modules')) ?? []
  },
}
