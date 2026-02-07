<template>
  <div class="verify-page">
    <div class="verify-container">
      <transition name="dialog" appear>
        <div class="verify-card">
          <div class="verify-header">
            <img class="verify-logo" src="../assets/images/emedx-logo.png" alt="EMEDX" />
            <h1 class="verify-title">Email verification</h1>
            <p class="verify-subtitle">We’re checking your verification link.</p>
          </div>
          
          <div v-if="loading" class="verify-content verify-loading">
            <div class="verify-spinner" role="status" aria-hidden="true"></div>
            <p class="verify-status-text">Verifying your email…</p>
          </div>
          
          <div v-else-if="success" class="verify-content">
            <div class="verify-message verify-message--success">
              <span class="verify-message-icon" aria-hidden="true">✓</span>
              <p class="verify-message-text">{{ message }}</p>
            </div>
            <router-link to="/login" class="verify-btn">Go to login</router-link>
          </div>
          
          <div v-else-if="error" class="verify-content">
            <div class="verify-message verify-message--error">
              <span class="verify-message-icon" aria-hidden="true">×</span>
              <p class="verify-message-text">{{ error }}</p>
            </div>
            <router-link to="/login" class="verify-btn">Go to login</router-link>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { orthancApiUrl } from '../globalConfigurations';

export default {
  name: 'VerifyEmail',
  data() {
    return {
      loading: true,
      success: false,
      error: null,
      message: 'Email verified successfully!'
    };
  },
  async mounted() {
    const token = this.$route.params.token;
    if (!token) {
      this.error = 'Invalid verification link';
      this.loading = false;
      return;
    }
    
    try {
      const response = await axios.get(`${orthancApiUrl}api/auth/verify-email/${token}`);
      if (response.data.success) {
        this.success = true;
        this.message = response.data.message || 'Email verified successfully!';
      }
    } catch (err) {
      this.error = err.response?.data?.error || 'Verification failed. The link may be invalid or expired.';
    } finally {
      this.loading = false;
    }
  }
};
</script>

<style scoped>
.verify-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  padding: 24px;
}

.verify-container {
  width: 100%;
  max-width: 420px;
}

.verify-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 48px 40px;
  border: 1px solid #e2e8f0;
}

.verify-header {
  text-align: center;
  margin-bottom: 32px;
}

.verify-logo {
  height: 48px;
  margin-bottom: 24px;
  object-fit: contain;
  display: block;
  margin-left: auto;
  margin-right: auto;
}

.verify-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
}

.verify-subtitle {
  font-size: 0.9375rem;
  color: #64748b;
  margin: 0;
}

.verify-content {
  text-align: center;
}

.verify-loading {
  padding: 8px 0;
}

.verify-spinner {
  width: 32px;
  height: 32px;
  margin: 0 auto 16px;
  border: 3px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: verify-spin 0.7s linear infinite;
}

@keyframes verify-spin {
  to { transform: rotate(360deg); }
}

.verify-status-text {
  font-size: 0.9375rem;
  color: #64748b;
  margin: 0;
}

.verify-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  text-align: left;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.verify-message--success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.verify-message--error {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.verify-message-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
}

.verify-message--success .verify-message-icon {
  background: #22c55e;
  color: #fff;
}

.verify-message--error .verify-message-icon {
  background: #ef4444;
  color: #fff;
}

.verify-message-text {
  margin: 0;
  font-size: 0.9375rem;
  color: #334155;
  line-height: 1.5;
}

.verify-message--success .verify-message-text {
  color: #166534;
}

.verify-message--error .verify-message-text {
  color: #991b1b;
}

.verify-btn {
  display: inline-block;
  padding: 12px 24px;
  background: #0f172a;
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
  border-radius: 10px;
  transition: background 0.2s, color 0.2s;
}

.verify-btn:hover {
  background: #1e293b;
  color: #fff;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.dialog-enter-to,
.dialog-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
