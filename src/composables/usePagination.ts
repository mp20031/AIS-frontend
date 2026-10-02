import { computed, ref, watch, type Ref } from 'vue'

/**
 * Client-side paging for a list that is already loaded in full (roles, users):
 * paging is purely a display concern that keeps the panel a fixed height.
 *
 * The page follows the selection, so an item created and appended at the end
 * comes into view, and falls back to the first page when a search hides it.
 * Watching the list too covers v-model's lag: an item created by a child is
 * only in the list after the parent re-renders.
 */
export function usePagination<T extends { id: string }>(
  items: Ref<T[]>,
  selectedId: Ref<string | null>,
  perPage: number,
) {
  const page = ref(1)
  const pageCount = computed(() => Math.max(1, Math.ceil(items.value.length / perPage)))
  const pagedItems = computed(() => items.value.slice((page.value - 1) * perPage, page.value * perPage))

  watch([selectedId, items], ([id]) => {
    const index = items.value.findIndex((item) => item.id === id)
    page.value = index === -1 ? 1 : Math.floor(index / perPage) + 1
  })
  // Clamp when a delete shrinks the list out from under the current page.
  watch(pageCount, (count) => {
    if (page.value > count) page.value = count
  })

  return { page, pageCount, pagedItems }
}
