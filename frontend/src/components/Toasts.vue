<script>
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js"
import { nextTick } from 'vue'


export default {
    props: [],
    emits: [],
    setup() {
    },
    data() {
        return {
            toasts: [],
            counter: 0,
            toastInstances: new Map(), // Store Bootstrap toast instances
        };
    },
    async created() {
        this.messageBus.on('show-toast', this.showToast);
        this.messageBus.on('show-success-toast', (message) => this.showToast(message, 'success'));
        this.messageBus.on('show-error-toast', (message) => this.showToast(message, 'error'));
        this.messageBus.on('show-info-toast', (message) => this.showToast(message, 'info'));
    },
    async mounted() {
    },
    computed: {
    },
    watch: {
    },
    components: {},
    methods: {
        async showToast(toastMessage, type = 'info') {
            this.counter += 1;
            const toastId = 'toast-' + this.counter;
            this.toasts.push({ 
                title: "", 
                message: toastMessage, 
                id: this.counter,
                type: type
            });

            await nextTick();

            const toastElement = document.getElementById(toastId);
            if (toastElement) {
                const toast = new bootstrap.Toast(toastElement, {
                    autohide: true,
                    delay: type === 'success' ? 3000 : 5000
                });
                
                // Store the toast instance
                this.toastInstances.set(this.counter, toast);
                
                toast.show();
                
                // Remove toast from array and instance map after it's hidden
                toastElement.addEventListener('hidden.bs.toast', () => {
                    const index = this.toasts.findIndex(t => t.id === this.counter);
                    if (index > -1) {
                        this.toasts.splice(index, 1);
                    }
                    // Remove from instances map
                    this.toastInstances.delete(this.counter);
                });
            }
        },
        closeToast(toastId) {
            // Try to hide via Bootstrap Toast instance first
            const toastInstance = this.toastInstances.get(toastId);
            if (toastInstance) {
                try {
                    toastInstance.hide();
                } catch (e) {
                    console.warn('Error hiding toast via Bootstrap:', e);
                    // Fallback: directly remove from array
                    this.removeToast(toastId);
                }
            } else {
                // If no instance found, directly remove from array
                this.removeToast(toastId);
            }
        },
        removeToast(toastId) {
            // Directly remove toast from array (triggers Vue reactivity)
            const index = this.toasts.findIndex(t => t.id === toastId);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
            // Clean up instance
            this.toastInstances.delete(toastId);
        },
    }

}
</script>


<template>
    <div id="toast-container" class="toast-container">
        <transition-group name="toast" tag="div">
            <div 
                v-for="toast in toasts" 
                :key="toast.id"
                :id="'toast-' + toast.id" 
                role="alert" 
                aria-live="polite" 
                aria-atomic="true"
                :class="['toast', 'modern-toast', `toast-${toast.type}`]"
                data-bs-autohide="true"
                data-bs-delay="5000">
                <div class="toast-content">
                    <div class="toast-icon">
                        <i v-if="toast.type === 'success'" class="bi bi-check-circle-fill"></i>
                        <i v-else-if="toast.type === 'error'" class="bi bi-x-circle-fill"></i>
                        <i v-else class="bi bi-info-circle-fill"></i>
                    </div>
                    <div class="toast-body">{{ toast.message }}</div>
                    <button 
                        type="button" 
                        class="toast-close" 
                        @click.stop="closeToast(toast.id)"
                        aria-label="Close">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            </div>
        </transition-group>
    </div>

</template>

<style scoped>
.toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
}

.modern-toast {
    min-width: 320px;
    max-width: 420px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    padding: 0;
    border: none;
    pointer-events: auto;
    animation: slideInRight 0.3s ease;
}

.toast-content {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    gap: 12px;
}

.toast-icon {
    flex-shrink: 0;
    font-size: 20px;
}

.toast-success .toast-icon {
    color: #10b981;
}

.toast-error .toast-icon {
    color: #ef4444;
}

.toast-info .toast-icon {
    color: #3b82f6;
}

.toast-body {
    flex: 1;
    font-size: 14px;
    color: #374151;
    line-height: 1.5;
    padding: 0;
}

.toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;
    font-size: 18px;
    width: 24px;
    height: 24px;
    pointer-events: auto;
    position: relative;
    z-index: 1;
}

.toast-close:hover {
    background-color: #f3f4f6;
    color: #374151;
}

.toast-success {
    border-left: 4px solid #10b981;
}

.toast-error {
    border-left: 4px solid #ef4444;
}

.toast-info {
    border-left: 4px solid #3b82f6;
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.toast-enter-active {
    transition: all 0.3s ease;
}

.toast-leave-active {
    transition: all 0.3s ease;
}

.toast-enter-from {
    transform: translateX(100%);
    opacity: 0;
}

.toast-leave-to {
    transform: translateX(100%);
    opacity: 0;
}

/* Dark mode support */
[data-bs-theme="dark"] .modern-toast {
    background: #1f2937;
}

[data-bs-theme="dark"] .toast-body {
    color: #f9fafb;
}

[data-bs-theme="dark"] .toast-close {
    color: #9ca3af;
}

[data-bs-theme="dark"] .toast-close:hover {
    background-color: #374151;
    color: #f9fafb;
}
</style>