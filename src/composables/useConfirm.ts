import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
}

// One dialog for the whole app (<ConfirmDialog /> in App.vue), driven from
// here, so any component can await a yes/no the way it used to await
// window.confirm — just styled, animated, and not blocking the page.
export const confirmState = reactive({
  open: false,
  options: { title: '' } as ConfirmOptions,
  resolve: null as ((value: boolean) => void) | null,
})

export function settleConfirm(value: boolean) {
  confirmState.open = false
  confirmState.resolve?.(value)
  confirmState.resolve = null
}

export function useConfirm() {
  return (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      confirmState.resolve?.(false) // a second request cancels the first
      confirmState.options = options
      confirmState.resolve = resolve
      confirmState.open = true
    })
}
