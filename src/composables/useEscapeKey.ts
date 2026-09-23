import { onMounted, onUnmounted } from 'vue'

// Each modal owner registers its own Escape handling, so no component has to
// know about modals that belong to someone else.
export function useEscapeKey(handler: () => void) {
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') handler()
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
