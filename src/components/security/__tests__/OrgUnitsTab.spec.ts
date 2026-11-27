import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import OrgUnitsTab from '@/components/security/OrgUnitsTab.vue'
import { confirmState, settleConfirm } from '@/composables/useConfirm'
import { useSession } from '@/composables/useSession'
import type { OrgUnitOut } from '@/services/securityService'
import { callsTo, json, mockFetch } from '@/services/__tests__/fetchMock'
import { grant, signInAs } from './securityFixtures'

const unit = (code: string, parent: string | null, type: string, path: string): OrgUnitOut => ({
  id: `ou-${code}`,
  parent_id: parent && `ou-${parent}`,
  code,
  name: code,
  type,
  path,
})

// `sv_x` sorts between `sv` and `sv.org1` as a string; the tree must still
// draw org1 under sv, not under sv_x.
const TREE = [
  unit('global', null, 'global', 'global'),
  unit('sv_x', 'global', 'country', 'global.sv_x'),
  unit('sv', 'global', 'country', 'global.sv'),
  unit('org1', 'sv', 'organization', 'global.sv.org1'),
  unit('suc1', 'org1', 'branch', 'global.sv.org1.suc1'),
  unit('dep1', 'suc1', 'Departamento', 'global.sv.org1.suc1.dep1'),
]

async function mountTab(routes: Parameters<typeof mockFetch>[0] = {}, orgUnits = TREE) {
  const fetchMock = mockFetch({ '/v1/grants': () => json(200, []), ...routes })
  const wrapper = mount(OrgUnitsTab, {
    props: { orgUnits },
    global: { directives: { autoAnimate: {} }, stubs: { teleport: true } },
  })
  await flushPromises()
  const rows = () => wrapper.findAll('.org-row strong').map((s) => s.text())
  // Find it the way a user would when its branch is collapsed: search, pick, clear.
  const open = async (name: string) => {
    await wrapper.find('.roles-search input').setValue(name)
    const row = wrapper.findAll('.org-row').find((r) => r.find('strong').text() === name)
    await row!.trigger('click')
    await wrapper.find('.roles-search input').setValue('')
  }
  return { wrapper, fetchMock, rows, open }
}

describe('OrgUnitsTab', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    useSession().clear()
    await signInAs(['iam.org_unit.manage', 'iam.org_unit.delete'])
  })

  it('starts with only the root open', async () => {
    const { rows } = await mountTab()
    expect(rows()).toEqual(['global', 'sv', 'sv_x'])
  })

  it('expands and collapses a branch', async () => {
    const { wrapper, rows } = await mountTab()
    const toggle = (name: string) => wrapper.find(`[aria-label="Expandir ${name}"], [aria-label="Contraer ${name}"]`)
    await toggle('sv').trigger('click')
    await toggle('org1').trigger('click')
    expect(rows()).toEqual(['global', 'sv', 'org1', 'suc1', 'sv_x'])
    expect(toggle('sv').attributes('aria-expanded')).toBe('true')
    await toggle('sv').trigger('click')
    expect(rows()).toEqual(['global', 'sv', 'sv_x'])
  })

  it('opens the ancestors of whatever gets selected, indented by depth', async () => {
    const { wrapper, rows, open } = await mountTab()
    await open('dep1')
    expect(rows()).toEqual(['global', 'sv', 'org1', 'suc1', 'dep1', 'sv_x'])
    expect(wrapper.findAll('.org-node')[4].attributes('style')).toContain('--depth: 4')
  })

  it('searches through collapsed branches', async () => {
    const { wrapper, rows } = await mountTab()
    await wrapper.find('.roles-search input').setValue('dep')
    expect(rows()).toEqual(['dep1'])
  })

  it('opens the root first, with its path and children', async () => {
    const { wrapper, open } = await mountTab()
    expect(wrapper.find('.security-card--hero h2').text()).toBe('global')
    await open('suc1')
    expect(wrapper.find('.security-card--hero p').text()).toBe('global › sv › org1 › suc1')
    expect(wrapper.findAll('.module-summary strong').map((s) => s.text())).toEqual(['dep1'])
  })

  it('shows the grants anchored on the selected unit only', async () => {
    const { wrapper, open } = await mountTab({
      '/v1/grants': () =>
        json(200, [
          grant('g1', 'Contador', { org_unit_id: 'ou-dep1', subject_username: 'user-88' }),
          grant('g2', 'Administrador IAM', { org_unit_id: 'ou-global', subject_username: 'jperez' }),
        ]),
    })
    await open('dep1')
    expect(wrapper.findAll('.grants-list strong').map((s) => s.text())).toEqual(['user-88'])
  })


  it('asks for the level name only on the free levels', async () => {
    const { wrapper, open } = await mountTab()
    const addUnder = async (name: string) => {
      await open(name)
      await wrapper.find('.security-card__actions .btn--primary').trigger('click')
      return wrapper.find('input[placeholder="p. ej. Departamento"]').exists()
    }
    expect(await addUnder('org1')).toBe(false)
    expect(await addUnder('suc1')).toBe(true)
  })

  it('stops offering children at the fifth level', async () => {
    const deep = [...TREE, unit('eq1', 'dep1', 'Equipo', 'global.sv.org1.suc1.dep1.eq1')]
    const { wrapper, open } = await mountTab({}, deep)
    await open('dep1')
    expect(wrapper.find('.security-card__actions .btn--primary').exists()).toBe(true)
    await open('eq1')
    expect(wrapper.find('.security-card__actions .btn--primary').exists()).toBe(false)
  })

  it('creates the unit, selects it and tells the parent to reload', async () => {
    const { wrapper, fetchMock, open } = await mountTab({
      '/v1/org-units': () => json(201, unit('suc2', 'org1', 'branch', 'global.sv.org1.suc2')),
    })
    await open('org1')
    await wrapper.find('.security-card__actions .btn--primary').trigger('click')
    const inputs = wrapper.findAll('.modal-card input')
    await inputs[0].setValue('Sucursal 2')
    await inputs[1].setValue('suc2')
    await wrapper.find('.modal-card').trigger('submit')
    await flushPromises()

    const [, init] = callsTo(fetchMock, '/v1/org-units')[0]
    expect(JSON.parse(String(init?.body))).toEqual({ parent_id: 'ou-org1', code: 'suc2', name: 'Sucursal 2', type: null })
    expect(wrapper.emitted('changed')).toHaveLength(1)

    await wrapper.setProps({ orgUnits: [...TREE, unit('suc2', 'org1', 'branch', 'global.sv.org1.suc2')] })
    expect(wrapper.find('.security-card--hero h2').text()).toBe('suc2')
  })

  it('deletes after confirming and falls back to the parent', async () => {
    const { wrapper, fetchMock, open } = await mountTab({ '/v1/org-units/ou-dep1': () => json(204) })
    await open('dep1')
    await wrapper.find('[aria-label="Eliminar unidad"]').trigger('click')
    expect(confirmState.open).toBe(true)
    settleConfirm(true)
    await flushPromises()

    expect(callsTo(fetchMock, '/v1/org-units/ou-dep1')[0][1]?.method).toBe('DELETE')
    expect(wrapper.find('.security-card--hero h2').text()).toBe('suc1')
  })

  it('never offers to delete the root', async () => {
    const { wrapper } = await mountTab()
    expect(wrapper.find('[aria-label="Eliminar unidad"]').exists()).toBe(false)
  })

  it('offers delete only with iam.org_unit.delete', async () => {
    useSession().clear()
    await signInAs(['iam.org_unit.manage'])
    const { wrapper, open } = await mountTab()
    await open('dep1')
    expect(wrapper.find('[aria-label="Renombrar unidad"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Eliminar unidad"]').exists()).toBe(false)
  })

  it('hides the controls without iam.org_unit.manage', async () => {
    useSession().clear()
    await signInAs(['iam.user.view'])
    const { wrapper } = await mountTab()
    expect(wrapper.find('.security-card__actions').exists()).toBe(false)
    expect(wrapper.find('.role-create-button').exists()).toBe(false)
  })
})
