import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useConfirm } from '@/composables/useConfirm'

const mounted: VueWrapper[] = []
const keep = <T extends VueWrapper>(wrapper: T) => (mounted.push(wrapper), wrapper)
const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('BaseModal', () => {
  const mountModal = (props: Record<string, unknown> = {}) =>
    keep(
      mount(BaseModal, {
        props: { open: true, title: 'Nuevo rol', ...props },
        slots: { default: '<input name="nombre" />', actions: '<button type="submit">Guardar</button>' },
        attachTo: document.body,
      }),
    )

  it('renders into <body> as a labelled dialog', () => {
    mountModal({ description: 'Crea un rol vacío' })
    const dialog = document.body.querySelector('[role="dialog"]')!

    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!)
    expect(title?.textContent).toBe('Nuevo rol')
    expect(dialog.textContent).toContain('Crea un rol vacío')
  })

  it('renders nothing while closed', () => {
    mountModal({ open: false })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('submitting the form emits submit, not a page reload', async () => {
    const wrapper = mountModal()
    document.body.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('Escape and a click on the backdrop close it', async () => {
    const wrapper = mountModal()
    press('Escape')
    document.body.querySelector('.modal-backdrop')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('a click inside the card does not close it', () => {
    const wrapper = mountModal()
    document.body.querySelector('input')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('Escape does nothing while closed', () => {
    const wrapper = mountModal({ open: false })
    press('Escape')
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})

describe('ConfirmDialog', () => {
  const open = async (options: Parameters<ReturnType<typeof useConfirm>>[0]) => {
    keep(mount(ConfirmDialog, { attachTo: document.body }))
    // Wrapped: an async function returning the promise itself would make
    // `await open()` wait for the dialog to be answered.
    const answer = useConfirm()(options)
    await nextTick()
    return { answer }
  }
  const button = (label: string) =>
    [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!

  it('shows the question, the message and the warning', async () => {
    await open({ title: '¿Eliminar el rol?', message: 'No se puede deshacer.', warning: 'Tiene 3 usuarios.' })
    const dialog = document.body.querySelector('[role="dialog"]')!

    expect(dialog.querySelector('h2')?.textContent).toBe('¿Eliminar el rol?')
    expect(dialog.textContent).toContain('No se puede deshacer.')
    expect(dialog.querySelector('[role="note"]')?.textContent).toContain('Tiene 3 usuarios.')
  })

  it('defaults its labels, and marks a dangerous action', async () => {
    await open({ title: '¿Seguro?' })
    expect(button('Cancelar')).toBeTruthy()
    expect(button('Confirmar').className).toContain('btn--primary')

    await open({ title: '¿Eliminar?', tone: 'danger', confirmLabel: 'Eliminar', cancelLabel: 'Volver' })
    expect(button('Eliminar').className).toContain('btn--danger')
    expect(button('Volver')).toBeTruthy()
  })

  it('starts focus on Cancelar, so Enter does not destroy', async () => {
    await open({ title: '¿Eliminar?', tone: 'danger' })
    expect(button('Cancelar').hasAttribute('data-autofocus')).toBe(true)
  })

  it('confirming resolves true and closes', async () => {
    const { answer } = await open({ title: '¿Eliminar?', confirmLabel: 'Eliminar' })
    button('Eliminar').click()
    await expect(answer).resolves.toBe(true)
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('Cancelar resolves false', async () => {
    const { answer } = await open({ title: '¿Eliminar?' })
    button('Cancelar').click()
    await expect(answer).resolves.toBe(false)
  })

  it('Escape resolves false', async () => {
    const { answer } = await open({ title: '¿Eliminar?' })
    press('Escape')
    await expect(answer).resolves.toBe(false)
  })
})

describe('BaseSelect', () => {
  const options = [
    { value: 'a', label: 'Auditoría' },
    { value: 'b', label: 'Bodega' },
    { value: 'c', label: 'Contabilidad' },
  ]

  const mountSelect = (initial?: string) => {
    const model = ref<string | undefined>(initial)
    const wrapper = keep(
      mount(
        defineComponent({
          setup: () => () =>
            h(BaseSelect<string>, {
              options,
              modelValue: model.value,
              'onUpdate:modelValue': (value: string | undefined) => (model.value = value),
              'aria-label': 'Módulo',
            }),
        }),
        { attachTo: document.body },
      ),
    )
    const trigger = wrapper.get('button[role="combobox"]')
    return { wrapper, model, trigger }
  }

  it('shows the placeholder, or the selected label', () => {
    expect(mountSelect().trigger.text()).toBe('Selecciona...')
    expect(mountSelect('b').trigger.text()).toBe('Bodega')
  })

  it('puts passed attributes on the button, not the wrapper', () => {
    expect(mountSelect().trigger.attributes('aria-label')).toBe('Módulo')
  })

  it('a click opens the list and choosing an option sets the model', async () => {
    const { wrapper, model, trigger } = mountSelect()
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await wrapper.findAll('[role="option"]')[2].trigger('click')
    expect(model.value).toBe('c')
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('works from the keyboard: arrows, Home/End, Enter', async () => {
    const { model, trigger } = mountSelect('a')

    await trigger.trigger('keydown', { key: 'ArrowDown' }) // opens on the current one
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await trigger.trigger('keydown', { key: 'Enter' })
    expect(model.value).toBe('b')

    await trigger.trigger('keydown', { key: 'Enter' })
    await trigger.trigger('keydown', { key: 'End' })
    await trigger.trigger('keydown', { key: 'ArrowDown' }) // stays on the last
    await trigger.trigger('keydown', { key: ' ' })
    expect(model.value).toBe('c')

    await trigger.trigger('keydown', { key: 'Enter' })
    await trigger.trigger('keydown', { key: 'Home' })
    await trigger.trigger('keydown', { key: 'ArrowUp' }) // stays on the first
    await trigger.trigger('keydown', { key: 'Enter' })
    expect(model.value).toBe('a')
  })

  it('typing a letter jumps to the next option starting with it, ignoring accents', async () => {
    const { model, trigger } = mountSelect('b')
    await trigger.trigger('keydown', { key: 'a' }) // "Auditoría", wrapping around
    await trigger.trigger('keydown', { key: 'Enter' })
    expect(model.value).toBe('a')
  })

  it('Escape closes the list without reaching the modal around it', async () => {
    const { wrapper, trigger } = mountSelect()
    let reachedWindow = false
    const listener = () => (reachedWindow = true)
    window.addEventListener('keydown', listener)

    await trigger.trigger('click')
    trigger.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    window.removeEventListener('keydown', listener)
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(reachedWindow).toBe(false)
  })

  it('a click outside closes it', async () => {
    const { wrapper, trigger } = mountSelect()
    await trigger.trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })
})
