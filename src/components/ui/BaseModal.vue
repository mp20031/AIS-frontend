<template>
  <Teleport to="body">
    <Transition name="modal" @after-enter="focusInitial" @after-leave="restoreFocus">
      <div v-if="open" class="modal-backdrop" @mousedown.self="emit('close')">
        <form
          ref="card"
          class="modal-card"
          :class="size !== 'md' && `modal-card--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @submit.prevent="emit('submit')"
        >
          <slot name="header" :title-id="titleId">
            <h2 :id="titleId">{{ title }}</h2>
          </slot>
          <p v-if="description">{{ description }}</p>

          <slot />

          <div v-if="$slots.actions" class="modal-card__actions">
            <slot name="actions" />
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { useEscapeKey } from '@/composables/useEscapeKey'

// Every modal in the app goes through here, so they all open, close, animate
// and handle focus the same way.
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    size?: 'sm' | 'md' | 'wide'
  }>(),
  { description: '', size: 'md' },
)

const emit = defineEmits<{ close: []; submit: [] }>()

const titleId = useId()
const card = ref<HTMLFormElement | null>(null)

useEscapeKey(() => {
  if (props.open) emit('close')
})

// Put focus inside on open, give it back to whatever opened the modal on close.
let opener: HTMLElement | null = null
watch(
  () => props.open,
  (open) => {
    if (open) opener = document.activeElement as HTMLElement | null
  },
  { immediate: true },
)

const focusInitial = () => {
  const target =
    card.value?.querySelector<HTMLElement>('[data-autofocus]') ??
    card.value?.querySelector<HTMLElement>('input, textarea, button:not(:disabled)')
  target?.focus()
}

const restoreFocus = () => {
  opener?.focus()
  opener = null
}
</script>
