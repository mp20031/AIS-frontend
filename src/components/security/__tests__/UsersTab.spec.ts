import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { settleConfirm, confirmState } from '@/composables/useConfirm'
import { useSession } from '@/composables/useSession'
import { callsTo, json, mockFetch } from '@/services/__tests__/fetchMock'
import { ALL_IAM, grant, orgUnit, role, signInAs, subject } from './securityFixtures'

const toast = vi.hoisted(() => ({ warning: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('vue3-toastify', () => ({ toast }))

const { default: UsersTab } = await import('@/components/security/UsersTab.vue')

const SUBJECTS = [
  subject('jperez', { display_name: 'José Pérez', active_grant_count: 2 }),
  subject('user-88', { email: 'contador@example.com', active_grant_count: 1 }),
  subject('baja', { active: false }),
]
const ROLES = [role('Contador', ['accounting.invoice.view', 'accounting.invoice.approve']), role('Auditor')]
const ORG_UNITS = [orgUnit('org1', 'org1'), orgUnit('div1', 'org1.div1')]

type Routes = Parameters<typeof mockFetch>[0]

async function mountUsers(routes: Routes = {}, subjects = SUBJECTS) {
  const fetchMock = mockFetch({ '/v1/grants': () => json(200, []), ...routes })
  const wrapper = mount(UsersTab, {
    props: { subjects, roles: ROLES, orgUnits: ORG_UNITS },
    global: { directives: { autoAnimate: {} }, stubs: { teleport: true } },
  })
  await flushPromises()
  const rows = () => wrapper.findAll('.role-row').map((row) => row.get('strong').text())
  const byLabel = (label: string) => wrapper.get(`[aria-label="${label}"]`)
  const dialog = (title: string) => wrapper.findAll('[role="dialog"]').find((d) => d.get('h2').text().startsWith(title))!
  return { wrapper, fetchMock, rows, byLabel, dialog }
}

/** Answer the next confirm dialog. */
async function answerConfirm(ok: boolean) {
  await vi.waitFor(() => expect(confirmState.open).toBe(true))
  const title = confirmState.options.title
  settleConfirm(ok)
  await flushPromises()
  return title
}

describe('UsersTab', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    useSession().clear()
    toast.success.mockReset()
    await signInAs(ALL_IAM, 'jperez')
  })

  describe('the list', () => {
    it('shows active users first, and selects the first one', async () => {
      const { rows, wrapper, fetchMock } = await mountUsers()
      expect(rows()).toEqual(['jperez', 'user-88'])
      expect(wrapper.get('.security-card--hero h2').text()).toBe('jperez')
      expect(callsTo(fetchMock, '/v1/grants')[0][0]).toContain('subject_id=id-jperez')
    })

    it('filters by status', async () => {
      const { wrapper, rows } = await mountUsers()
      await wrapper.get('select').setValue('inactive')
      expect(rows()).toEqual(['baja Inactivo'])
      await wrapper.get('select').setValue('all')
      expect(rows()).toHaveLength(3)
    })

    it('searches by username, name or email, ignoring accents and case', async () => {
      const { wrapper, rows } = await mountUsers()
      const search = wrapper.get('input[type="search"]')

      await search.setValue('jose')
      expect(rows()).toEqual(['jperez'])
      await search.setValue('CONTADOR@')
      expect(rows()).toEqual(['user-88'])
      await search.setValue('nadie')
      expect(rows()).toEqual([])
      expect(wrapper.text()).toContain('Ningun usuario coincide con "nadie".')
    })

    it("shows the selected user's grants", async () => {
      const { wrapper } = await mountUsers({
        '/v1/grants': () => json(200, [grant('g1', 'Contador', { inherit_down: true })]),
      })
      const item = wrapper.get('.grants-list li')
      expect(item.text()).toContain('Contador')
      expect(item.text()).toContain('DIV1 (+ descendientes)')
      expect(item.text()).toContain('allow')
    })

    it('says so when the user has no roles', async () => {
      const { wrapper } = await mountUsers()
      expect(wrapper.text()).toContain('Este usuario no tiene ningun rol asignado actualmente.')
    })
  })

  describe('what the user is allowed to see', () => {
    it('a view-only account gets no action buttons', async () => {
      await signInAs(['iam.user.view'])
      const { wrapper } = await mountUsers({ '/v1/grants': () => json(200, [grant('g1', 'Contador')]) })
      await wrapper.findAll('.role-row')[1].trigger('click')
      await flushPromises()

      for (const label of ['Agregar usuario', 'Asignar rol', 'Editar usuario', 'Desactivar usuario', 'Revocar rol']) {
        expect(wrapper.find(`[aria-label="${label}"]`).exists(), label).toBe(false)
      }
    })

    it('nobody can edit or deactivate themselves', async () => {
      const { wrapper } = await mountUsers()
      expect(wrapper.get('.security-card--hero h2').text()).toBe('jperez')
      expect(wrapper.find('[aria-label="Editar usuario"]').exists()).toBe(false)
      expect(wrapper.find('[aria-label="Desactivar usuario"]').exists()).toBe(false)
    })
  })

  describe('creating a user', () => {
    const fillCreate = async (wrapper: Awaited<ReturnType<typeof mountUsers>>['wrapper'], password: string) => {
      const form = wrapper.findAll('[role="dialog"]').find((d) => d.text().includes('Nuevo Usuario'))!
      await form.get('input[placeholder="p. ej. jperez"]').setValue('  diego  ')
      await form.get('input[placeholder="p. ej. Juan Perez"]').setValue('Diego')
      await form.get('input[type="email"]').setValue('diego@example.com')
      await form.get('input[type="password"]').setValue(password)
      return form
    }

    it('requires a username', async () => {
      const { wrapper, byLabel, fetchMock } = await mountUsers()
      await byLabel('Agregar usuario').trigger('click')
      const form = wrapper.findAll('[role="dialog"]').find((d) => d.text().includes('Nuevo Usuario'))!
      await form.trigger('submit')

      expect(form.text()).toContain('Ingresa un usuario.')
      expect(callsTo(fetchMock, '/v1/subjects')).toHaveLength(0)
    })

    it('requires a 12-character password before calling the API', async () => {
      const { wrapper, byLabel, fetchMock } = await mountUsers()
      await byLabel('Agregar usuario').trigger('click')
      const form = await fillCreate(wrapper, 'corta')
      await form.trigger('submit')

      expect(form.text()).toContain('La contraseña debe tener al menos 12 caracteres.')
      expect(callsTo(fetchMock, '/v1/subjects')).toHaveLength(0)
    })

    it('creates the user with its password, then grants the initial role', async () => {
      const { wrapper, byLabel, fetchMock } = await mountUsers({
        '/v1/subjects': () => json(201, subject('diego')),
        '/v1/grants': (_url, init) => json(init.method === 'POST' ? 201 : 200, init.method === 'POST' ? grant('g9', 'Contador') : []),
      })
      await byLabel('Agregar usuario').trigger('click')
      const form = await fillCreate(wrapper, 'una-clave-larga')
      await form.trigger('submit')
      await flushPromises()

      const [, createInit] = callsTo(fetchMock, '/v1/subjects')[0]
      expect(JSON.parse(String(createInit?.body))).toEqual({
        username: 'diego',
        password: 'una-clave-larga',
        display_name: 'Diego',
        email: 'diego@example.com',
        active: true,
      })

      const grantPost = callsTo(fetchMock, '/v1/grants').find(([, init]) => init?.method === 'POST')!
      expect(JSON.parse(String(grantPost[1]?.body))).toEqual({
        subject_id: 'id-diego',
        role_id: 'role-Contador',
        org_unit_id: 'ou-org1',
        inherit_down: false,
        effect: 'allow',
      })
      expect(wrapper.emitted('subjectsChanged')).toHaveLength(1)
      expect(wrapper.emitted('grantsChanged')).toHaveLength(1)
      expect(wrapper.findAll('[role="dialog"]').some((d) => d.text().includes('Nuevo Usuario'))).toBe(false)
    })

    it('shows the API error inside the dialog', async () => {
      const { wrapper, byLabel } = await mountUsers({
        '/v1/subjects': () => json(409, { detail: "El usuario 'diego' ya existe" }),
      })
      await byLabel('Agregar usuario').trigger('click')
      const form = await fillCreate(wrapper, 'una-clave-larga')
      await form.trigger('submit')
      await flushPromises()

      expect(form.text()).toContain("El usuario 'diego' ya existe")
      expect(wrapper.emitted('subjectsChanged')).toBeUndefined()
    })
  })

  describe('managing another user', () => {
    const selectUser88 = async (ctx: Awaited<ReturnType<typeof mountUsers>>) => {
      await ctx.wrapper.findAll('.role-row')[1].trigger('click')
      await flushPromises()
    }

    it('deactivating asks first, then patches and reports', async () => {
      const ctx = await mountUsers({ '/v1/subjects/id-user-88': () => json(200, subject('user-88', { active: false })) })
      await selectUser88(ctx)

      await ctx.byLabel('Desactivar usuario').trigger('click')
      expect(await answerConfirm(true)).toBe('Desactivar el usuario "user-88"?')

      const [, init] = callsTo(ctx.fetchMock, '/v1/subjects/id-user-88')[0]
      expect(init?.method).toBe('PATCH')
      expect(JSON.parse(String(init?.body))).toEqual({ active: false })
      expect(toast.success).toHaveBeenCalledWith('Usuario desactivado correctamente.')
      expect(ctx.wrapper.emitted('subjectsChanged')).toHaveLength(1)
    })

    it('cancelling the confirmation changes nothing', async () => {
      const ctx = await mountUsers()
      await selectUser88(ctx)
      await ctx.byLabel('Desactivar usuario').trigger('click')
      await answerConfirm(false)

      expect(callsTo(ctx.fetchMock, '/v1/subjects/id-user-88')).toHaveLength(0)
    })

    it('editing saves the name and email', async () => {
      const ctx = await mountUsers({ '/v1/subjects/id-user-88': () => json(200, subject('user-88')) })
      await selectUser88(ctx)
      await ctx.byLabel('Editar usuario').trigger('click')

      const form = ctx.dialog('Editar usuario')
      await form.get('input[type="text"]').setValue(' Contador 88 ')
      await form.get('input[type="email"]').setValue('')
      await form.trigger('submit')
      await flushPromises()

      const [, init] = callsTo(ctx.fetchMock, '/v1/subjects/id-user-88')[0]
      expect(JSON.parse(String(init?.body))).toEqual({ display_name: 'Contador 88', email: null })
      expect(toast.success).toHaveBeenCalledWith('Usuario actualizado correctamente.')
    })

    it('editing to an email in use flags the email field', async () => {
      const ctx = await mountUsers({
        '/v1/subjects/id-user-88': () => json(409, { detail: "El correo 'x' ya está en uso" }),
      })
      await selectUser88(ctx)
      await ctx.byLabel('Editar usuario').trigger('click')
      const form = ctx.dialog('Editar usuario')
      await form.trigger('submit')
      await flushPromises()

      expect(form.get('input[type="email"]').attributes('aria-invalid')).toBe('true')
      expect(form.text()).toContain('El correo ya está en uso')
    })

    it('assigning a role creates the grant and reloads the list', async () => {
      const ctx = await mountUsers({
        '/v1/grants': (_url, init) => json(init.method === 'POST' ? 201 : 200, init.method === 'POST' ? grant('g1', 'Contador') : []),
      })
      await selectUser88(ctx)
      await ctx.byLabel('Asignar rol').trigger('click')

      const form = ctx.dialog('Asignar Rol')
      expect(form.text()).toContain('2 permisos incluidos')
      await form.get('[aria-label="Aplica a subunidades"]').trigger('click')
      await form.trigger('submit')
      await flushPromises()

      const post = callsTo(ctx.fetchMock, '/v1/grants').find(([, init]) => init?.method === 'POST')!
      expect(JSON.parse(String(post[1]?.body))).toEqual({
        subject_id: 'id-user-88',
        role_id: 'role-Contador',
        org_unit_id: 'ou-org1',
        inherit_down: true,
        effect: 'allow',
      })
      expect(ctx.wrapper.emitted('grantsChanged')).toHaveLength(1)
    })

    it('revoking a grant asks first, then deletes it', async () => {
      const ctx = await mountUsers({
        '/v1/grants': () => json(200, [grant('g1', 'Contador')]),
        '/v1/grants/g1': () => json(200, grant('g1', 'Contador')),
      })
      await selectUser88(ctx)
      await ctx.byLabel('Revocar rol').trigger('click')
      await answerConfirm(true)

      expect(callsTo(ctx.fetchMock, '/v1/grants/g1')[0][1]?.method).toBe('DELETE')
      expect(ctx.wrapper.emitted('grantsChanged')).toHaveLength(1)
    })

    it('"revoke all" deletes every active grant', async () => {
      const ctx = await mountUsers({
        '/v1/grants': () => json(200, [grant('g1', 'Contador'), grant('g2', 'Auditor')]),
        '/v1/grants/g1': () => json(200, {}),
        '/v1/grants/g2': () => json(200, {}),
      })
      await selectUser88(ctx)
      await ctx.byLabel('Revocar todos los roles').trigger('click')
      expect(await answerConfirm(true)).toBe('Revocar todos los roles de user-88?')

      expect(callsTo(ctx.fetchMock, '/v1/grants/g1')).toHaveLength(1)
      expect(callsTo(ctx.fetchMock, '/v1/grants/g2')).toHaveLength(1)
    })
  })
})
