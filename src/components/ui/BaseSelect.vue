<template>
  <div ref="root" class="select" :class="{ 'select--open': open }">
    <button
      v-bind="$attrs"
      type="button"
      class="select__trigger"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      @click="open ? close() : openList()"
      @keydown="onKeydown"
    >
      <span class="select__value" :class="{ 'select__value--placeholder': !selected }">
        {{ selected?.label ?? placeholder }}
      </span>
      <ChevronDown :size="16" class="select__chevron" aria-hidden="true" />
    </button>

    <Transition name="select-pop">
      <ul v-if="open" :id="listId" ref="list" class="select__list" role="listbox">
        <li
          v-for="(option, i) in options"
          :id="optionId(i)"
          :key="String(option.value)"
          role="option"
          class="select__option"
          :class="{ 'select__option--active': i === activeIndex }"
          :aria-selected="option.value === modelValue"
          :style="option.depth ? { paddingLeft: `${12 + option.depth * 14}px` } : undefined"
          @mousemove="activeIndex = i"
          @mousedown.prevent
          @click="choose(i)"
        >
          <span>{{ option.label }}</span>
          <Check v-if="option.value === modelValue" :size="14" aria-hidden="true" />
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onUnmounted, ref, useId, watch } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'

export interface SelectOption<V> {
  value: V
  label: string
  /** Indent level, for tree-shaped lists like org units. */
  depth?: number
}

// Attributes (aria-labelledby, data-autofocus...) belong on the button, which
// is what receives focus — not on the wrapper.
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ options: SelectOption<T>[]; placeholder?: string }>(), {
  placeholder: 'Selecciona...',
})
const modelValue = defineModel<T>()

const listId = useId()
const optionId = (i: number) => `${listId}-${i}`

const root = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)
const open = ref(false)
const activeIndex = ref(-1)

const selected = computed(() => props.options.find((o) => o.value === modelValue.value))

const openList = () => {
  open.value = true
  activeIndex.value = Math.max(0, props.options.findIndex((o) => o.value === modelValue.value))
}

const close = () => {
  open.value = false
}

const choose = (i: number) => {
  const option = props.options[i]
  if (option) modelValue.value = option.value
  close()
}

const move = (to: number) => {
  const last = props.options.length - 1
  activeIndex.value = Math.min(Math.max(to, 0), last)
}

// Type a letter to jump to the next option starting with it.
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const typeAhead = (char: string) => {
  const n = props.options.length
  for (let step = 1; step <= n; step++) {
    const i = (activeIndex.value + step) % n
    if (normalize(props.options[i].label).startsWith(normalize(char))) {
      if (!open.value) openList()
      activeIndex.value = i
      return
    }
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openList()
    } else if (event.key.length === 1) {
      typeAhead(event.key)
    }
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(activeIndex.value + 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(activeIndex.value - 1)
      break
    case 'Home':
      event.preventDefault()
      move(0)
      break
    case 'End':
      event.preventDefault()
      move(props.options.length - 1)
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      choose(activeIndex.value)
      break
    case 'Escape':
      // Close only the list — not the modal it sits in.
      event.preventDefault()
      event.stopPropagation()
      close()
      break
    case 'Tab':
      close()
      break
    default:
      if (event.key.length === 1) typeAhead(event.key)
  }
}

watch(activeIndex, async (i) => {
  await nextTick()
  list.value?.querySelector(`#${CSS.escape(optionId(i))}`)?.scrollIntoView({ block: 'nearest' })
})

// Click outside closes.
const onPointerDown = (event: PointerEvent) => {
  if (!root.value?.contains(event.target as Node)) close()
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onPointerDown)
  else document.removeEventListener('pointerdown', onPointerDown)
})
onUnmounted(() => document.removeEventListener('pointerdown', onPointerDown))
</script>
