<template>
  <div class="verify-page">
    <div class="verify-container">
      <transition name="dialog" appear>
        <div class="verify-card">
          <div class="verify-header">
            <img class="verify-logo" src="../assets/images/emedx-logo.png" alt="EMEDX Logo" />
            <h1 class="verify-title">Email Verification</h1>
          </div>
          
          <div v-if="loading" class="verify-content">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p>Verifying your email...</p>
          </div>
          
          <div v-else-if="success" class="verify-content">
            <div class="alert alert-success">
              <i class="bi bi-check-circle-fill"></i>
              <p>{{ message }}</p>
            </div>
            <router-link to="/login" class="btn btn-primary">Go to Login</router-link>
          </div>
          
          <div v-else-if="error" class="verify-content">
            <div class="alert alert-danger">
              <i class="bi bi-x-circle-fill"></i>
              <p>{{ error }}</p>
            </div>
            <router-link to="/login" class="btn btn-primary">Go to Login</router-link>
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
    } catch (error) {
      this.error = error.response?.data?.error || 'Verification failed. The link may be invalid or expired.';
    } finally {
      this.loading = false;
    }
  }
};
</script>

<style scoped>
.verify-page {
  min-height: 100vh;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: 
    linear-gradient(180deg, rgba(74, 144, 226, 0.85) 0%, rgba(53, 122, 189, 0.85) 100%),
    url('https://images.unsplash.com/photo-1559757148-5c350d0d3c56?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: 40px 20px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
}

.verify-container {
  width: 100%;
  max-width: 500px;
  position: relative;
  z-index: 1;
}

.verify-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 40px 50px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.verify-header {
  text-align: center;
  margin-bottom: 32px;
}

.verify-logo {
  height: 70px;
  margin-bottom: 20px;
  object-fit: contain;
}

.verify-title {
  color: #1a1f2e;
  font-size: 28px;
  font-weight: 600;
  margin: 0;
}

.verify-content {
  text-align: center;
}

.verify-content p {
  margin: 20px 0;
  color: #374151;
}

.alert {
  padding: 16px;
  border-radius: 10px;
  margin-bottom: 24px;
}

.alert-success {
  background: #d1fae5;
  color: #059669;
  border: 1px solid #10b981;
}

.alert-danger {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #ef4444;
}

.alert i {
  font-size: 24px;
  margin-bottom: 10px;
  display: block;
}

.spinner-border {
  width: 3rem;
  height: 3rem;
  margin-bottom: 20px;
}

.btn-primary {
  padding: 12px 24px;
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
}

/* Dialog transition */
.dialog-enter-active, .dialog-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.dialog-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

.dialog-leave-to {
  opacity: 0;
  transform: translateY(-30px) scale(0.95);
}

.dialog-enter-to, .dialog-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
