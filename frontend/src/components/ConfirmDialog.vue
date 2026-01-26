<template>
  <div v-if="show" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-dialog confirm-modal-dialog">
      <div class="modal-content confirm-modal-content">
        <div class="modal-header confirm-modal-header">
          <div class="confirm-header-content">
            <h5 class="modal-title">
              {{ title }}
            </h5>
            <button 
              type="button" 
              class="confirm-close-btn" 
              @click="handleCancel" 
              aria-label="Close"
            >
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
        <div class="modal-body confirm-modal-body">
          <p class="confirm-message">{{ message }}</p>
        </div>
        <div class="modal-footer confirm-modal-footer">
          <button 
            type="button" 
            class="btn btn-secondary confirm-btn-cancel" 
            @click="handleCancel"
          >
            {{ cancelText }}
          </button>
          <button 
            type="button" 
            class="btn confirm-btn-action" 
            :class="confirmButtonClass"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConfirmDialog',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: 'Confirm Action'
    },
    message: {
      type: String,
      required: true
    },
    confirmText: {
      type: String,
      default: 'Confirm'
    },
    cancelText: {
      type: String,
      default: 'Cancel'
    },
    confirmButtonClass: {
      type: String,
      default: 'btn-primary'
    }
  },
  methods: {
    handleConfirm() {
      this.$emit('confirm');
    },
    handleCancel() {
      this.$emit('cancel');
    }
  }
};
</script>

<style scoped>
/* Confirm Modal - Modern & Simple */
.confirm-modal-dialog {
  max-width: 450px;
  animation: modal-fade-in 0.2s ease-out;
}

.confirm-modal-content {
  border: none;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  background: white;
}

.confirm-modal-header {
  padding: 0;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.confirm-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 20px 24px;
  gap: 16px;
}

.confirm-modal-header .modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  flex: 1;
  color: #111827;
}

.confirm-close-btn {
  flex-shrink: 0;
  margin: 0;
  padding: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: #6b7280;
  font-size: 18px;
  line-height: 1;
}

.confirm-close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.confirm-close-btn:active {
  background: #e5e7eb;
}

.confirm-modal-body {
  padding: 24px;
  background: white;
}

.confirm-message {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: #374151;
}

.confirm-message strong {
  color: #111827;
  font-weight: 600;
}

.confirm-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: white;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-btn-cancel {
  min-width: 90px;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.confirm-btn-cancel:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #111827;
}

.confirm-btn-action {
  min-width: 110px;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: none;
}

.confirm-btn-action.btn-primary {
  background: #3b82f6;
  color: white;
}

.confirm-btn-action.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.confirm-btn-action.btn-success {
  background: #10b981;
  color: white;
}

.confirm-btn-action.btn-success:hover:not(:disabled) {
  background: #059669;
}

.confirm-btn-action.btn-danger {
  background: #ef4444;
  color: white;
}

.confirm-btn-action.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.confirm-btn-action.btn-warning {
  background: #f59e0b;
  color: white;
}

.confirm-btn-action.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

.confirm-btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modal-fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 20px;
  animation: fade-in 0.2s ease-out;
}
</style>
