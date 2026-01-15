<script>
export default {
    props: [],
    data() {
        return {
            path: null
        };
    },
    mounted() {
        this.path = this.$router.currentRoute.value.fullPath;
    },
    methods: {
        goHome() {
            this.$router.push('/');
        },
        goBack() {
            this.$router.back();
        }
    }
}
</script>

<template>
    <div class="not-found-container">
        <div class="not-found-content">
            <div class="not-found-icon">
                <i class="bi bi-exclamation-circle"></i>
            </div>
            <h1 class="not-found-code">404</h1>
            <h2 class="not-found-title">Page Not Found</h2>
            <p class="not-found-message">
                The page you're looking for doesn't exist or has been moved.
            </p>
            <p class="not-found-path" v-if="path">
                <code>{{ path }}</code>
            </p>
            <div class="not-found-actions">
                <button class="btn btn-primary" @click="goHome">
                    <i class="bi bi-house me-2"></i>Go to Dashboard
                </button>
                <button class="btn btn-outline-secondary" @click="goBack">
                    <i class="bi bi-arrow-left me-2"></i>Go Back
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.not-found-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    padding: 40px 20px;
}

.not-found-content {
    text-align: center;
    max-width: 500px;
}

.not-found-icon {
    font-size: 80px;
    color: var(--bs-secondary);
    opacity: 0.3;
    margin-bottom: 20px;
}

.not-found-code {
    font-size: 120px;
    font-weight: 700;
    color: var(--bs-primary);
    line-height: 1;
    margin: 0;
    letter-spacing: -5px;
}

.not-found-title {
    font-size: 28px;
    font-weight: 600;
    color: var(--bs-body-color);
    margin: 20px 0 10px;
}

.not-found-message {
    font-size: 16px;
    color: var(--bs-secondary-color);
    margin-bottom: 15px;
}

.not-found-path {
    margin-bottom: 30px;
}

.not-found-path code {
    background-color: var(--bs-light);
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--bs-danger);
    word-break: break-all;
}

.not-found-actions {
    display: flex;
    gap: 15px;
    justify-content: center;
    flex-wrap: wrap;
}

.not-found-actions .btn {
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 500;
    transition: all 0.2s;
}

.not-found-actions .btn:hover {
    transform: translateY(-2px);
}
</style>
