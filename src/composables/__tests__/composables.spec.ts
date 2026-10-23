import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { confirmState, settleConfirm, useConfirm } from '@/composables/useConfirm'
import { useEscapeKey } from '@/composables/useEscapeKey'
import { usePagination } from '@/composables/usePagination'

describe('useConfirm', () => {
  it('opens the dialog with the options and resolves with the answer', async () => {
    const confirm = useConfirm()
    const answer = confirm({ title: '¿Eliminar rol?', tone: 'danger' })

    expect(confirmState.open).toBe(true)
    expect(confirmState.options.title).toBe('¿Eliminar rol?')

    settleConfirm(true)
    await expect(answer).resolves.toBe(true)
    expect(confirmState.open).toBe(false)
  })

  it('a second request cancels the first', async () => {
    const confirm = useConfirm()
    const first = confirm({ title: 'uno' })
    const second = confirm({ title: 'dos' })

    await expect(first).resolves.toBe(false)
    expect(confirmState.options.title).toBe('dos')

    settleConfirm(true)
    await expect(second).resolves.toBe(true)
  })

  it('settling with nothing pending is harmless', () => {
    expect(() => settleConfirm(false)).not.toThrow()
  })
})

describe('useEscapeKey', () => {
  it('calls the handler on Escape while mounted, and stops after unmount', () => {
    const handler = vi.fn()
    const wrapper = mount(
      defineComponent({
        setup() {
          useEscapeKey(handler)
          return () => h('div')
        },
      }),
    )

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(handler).not.toHaveBeenCalled()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(handler).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('usePagination', () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}` }))

  it('slices the list into pages', () => {
    const { page, pageCount, pagedItems } = usePagination(ref(items(7)), ref(null), 3)

    expect(pageCount.value).toBe(3)
    expect(pagedItems.value.map((i) => i.id)).toEqual(['i0', 'i1', 'i2'])
    page.value = 3
    expect(pagedItems.value.map((i) => i.id)).toEqual(['i6'])
  })

  it('an empty list still has one page', () => {
    expect(usePagination(ref([]), ref(null), 5).pageCount.value).toBe(1)
  })

  it('follows the selection to its page', async () => {
    const selected = ref<string | null>(null)
    const { page } = usePagination(ref(items(10)), selected, 3)

    selected.value = 'i7'
    await nextTick()
    expect(page.value).toBe(3)
  })

  it('goes back to the first page when the selection is not in the list', async () => {
    const selected = ref<string | null>('i7')
    const list = ref(items(10))
    const { page } = usePagination(list, selected, 3)
    page.value = 3

    selected.value = 'gone'
    await nextTick()
    expect(page.value).toBe(1)
  })

  it('brings an item appended later into view once the list catches up', async () => {
    const list = ref(items(6))
    const selected = ref<string | null>('new')
    const { page } = usePagination(list, selected, 3)

    list.value = [...list.value, { id: 'new' }]
    await nextTick()
    expect(page.value).toBe(3)
  })

  it('stays on the selected item when a delete shrinks the list', async () => {
    const list = ref(items(9))
    const selected = ref<string | null>('i4')
    const { page, pageCount } = usePagination(list, selected, 3)

    list.value = list.value.filter((item) => item.id !== 'i0')
    await nextTick()
    expect(pageCount.value).toBe(3)
    expect(page.value).toBe(2)
  })

  it('with nothing selected, a change in the list goes back to the first page', async () => {
    const list = ref(items(7))
    const { page } = usePagination(list, ref(null), 3)
    page.value = 3

    list.value = items(4)
    await nextTick()
    expect(page.value).toBe(1)
  })
})
