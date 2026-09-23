<template>
  <BaseModal
    :open="confirmState.open"
    :title="options.title"
    size="sm"
    @close="settleConfirm(false)"
    @submit="settleConfirm(true)"
  >
    <template #header="{ titleId }">
      <div class="confirm-dialog__header">
        <span v-if="options.tone === 'danger'" class="confirm-dialog__icon" aria-hidden="true">
          <TriangleAlert :size="18" />
        </span>
        <h2 :id="titleId">{{ options.title }}</h2>
      </div>
    </template>

    <p v-if="options.message" class="confirm-dialog__message">{{ options.message }}</p>

    <template #actions>
      <!-- Focus starts on Cancelar: Enter on a destructive dialog should not destroy. -->
      <button class="btn" type="button" data-autofocus @click="settleConfirm(false)">
        {{ options.cancelLabel ?? 'Cancelar' }}
      </button>
      <button class="btn" :class="options.tone === 'danger' ? 'btn--danger' : 'btn--primary'" type="submit">
        {{ options.confirmLabel ?? 'Confirmar' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TriangleAlert } from 'lucide-vue-next'
import BaseModal from '@/components/ui/BaseModal.vue'
import { confirmState, settleConfirm } from '@/composables/useConfirm'

const options = computed(() => confirmState.options)
</script>
