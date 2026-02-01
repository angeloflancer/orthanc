<template>
  <div class="login-page">
    <div class="login-container">
      <transition name="dialog" appear>
        <div class="login-card" :key="requiresOtpStep ? 'otp' : 'login'">
          <div class="login-header">
            <img class="login-logo" src="../assets/images/emedx-logo.png" alt="EMEDX Logo" />
            <h1 class="login-title">{{ requiresOtpStep ? 'Verification code' : 'Welcome Back' }}</h1>
            <p class="login-subtitle">
              {{ requiresOtpStep ? 'Enter the code sent to your email' : 'Sign in to continue to your account' }}
            </p>
          </div>

          <!-- Step 1: Email + Password -->
          <form v-if="!requiresOtpStep" @submit.prevent="handleLogin" class="login-form">
            <div v-if="isBlocked" class="alert alert-blocked">
              <i class="bi bi-slash-circle me-2"></i>
              <div>
                <strong>Account Suspended</strong>
                <p class="mb-0 mt-1">Your account has been suspended. Please contact the owner for assistance.</p>
              </div>
            </div>
            <div v-if="error && !isBlocked" class="alert alert-danger">
              {{ error }}
              <div v-if="unverifiedEmail && !resendSuccess" class="mt-2">
                <button
                  type="button"
                  @click="handleResendVerification"
                  class="btn btn-link p-0 text-decoration-underline"
                  :disabled="resendLoading"
                  style="font-size: 0.9rem; color: #4a90e2;"
                >
                  {{ resendLoading ? 'Sending...' : 'Resend verification email' }}
                </button>
              </div>
            </div>
            <div v-if="resendSuccess" class="alert alert-success">
              Verification email sent! Please check your inbox.
            </div>
            <div class="form-group">
              <label for="email">Email or Username</label>
              <input
                id="email"
                v-model="email"
                type="text"
                class="form-control"
                placeholder="Enter your email or username"
                required
                autocomplete="username"
              />
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <div class="password-input-wrapper">
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="form-control"
                  placeholder="Enter your password"
                  required
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  class="password-toggle"
                  @click="showPassword = !showPassword"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                >
                  <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                </button>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block" :disabled="loading || emailNotVerified">
              <span v-if="loading">Signing in...</span>
              <span v-else>Sign In</span>
            </button>
            <div class="login-footer">
              <p>Don't have an account? <router-link to="/register">Register here</router-link></p>
            </div>
          </form>

          <!-- Step 2: OTP (owner verification) -->
          <form v-else @submit.prevent="handleVerifyOtp" class="login-form">
            <div v-if="error" class="alert alert-danger">{{ error }}</div>
            <p class="otp-email-hint">Code sent to <strong>{{ otpEmail }}</strong></p>
            <div class="form-group">
              <label for="otp">Verification code</label>
              <input
                id="otp"
                v-model="otpCode"
                type="text"
                class="form-control otp-input"
                placeholder="Enter 6-digit code"
                maxlength="6"
                autocomplete="one-time-code"
                inputmode="numeric"
                pattern="[0-9]*"
              />
            </div>
            <button type="submit" class="btn btn-primary btn-block" :disabled="loading || otpCode.length < 6">
              <span v-if="loading">Verifying...</span>
              <span v-else>Verify and sign in</span>
            </button>
            <button type="button" class="btn btn-link btn-back" @click="backToLogin">
              Back to sign in
            </button>
          </form>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { orthancApiUrl } from '../globalConfigurations';
import orthancApi from '../orthancApi';

export default {
  name: 'Login',
  data() {
    return {
      email: '',
      password: '',
      error: '',
      loading: false,
      resendLoading: false,
      resendSuccess: false,
      unverifiedEmail: null,
      emailNotVerified: false,
      showPassword: false,
      isBlocked: false,
      requiresOtpStep: false,
      otpCode: '',
      otpEmail: ''
    };
  },
  methods: {
    backToLogin() {
      this.requiresOtpStep = false;
      this.otpCode = '';
      this.otpEmail = '';
      this.error = '';
    },
    finishLogin(responseData) {
      localStorage.setItem('auth-token', responseData.token);
      localStorage.setItem('user', JSON.stringify(responseData.user));
      orthancApi.updateAuthHeader('auth-token');
      const bus = this.messageBus || this.$messageBus;
      if (bus) {
        bus.emit('show-success-toast', this.$t('login_success_message') || 'Sign in successful!');
      }
      const urlParams = new URLSearchParams(window.location.search);
      const params = {};
      const validParams = ['StudyInstanceUID', 'PatientID', 'AccessionNumber', 'StudyDate',
        'PatientName', 'StudyDescription', 'ModalitiesInStudy', 'labels',
        'source-type', 'remote-source', 'order-by', 'labels-constraint'];
      for (const key of validParams) {
        if (urlParams.has(key)) params[key] = urlParams.get(key);
      }
      setTimeout(() => {
        this.$router.push(Object.keys(params).length > 0 ? { path: '/', query: params } : '/');
      }, 300);
    },
    async handleLogin() {
      this.error = '';
      this.emailNotVerified = false;
      this.isBlocked = false;
      this.loading = true;

      try {
        const response = await axios.post(`${orthancApiUrl}api/auth/login`, {
          email: this.email,
          username: this.email,
          password: this.password
        });

        if (response.data.success) {
          if (response.data.requiresOtp && response.data.email) {
            this.requiresOtpStep = true;
            this.otpEmail = response.data.email;
            this.otpCode = '';
            this.error = '';
          } else {
            this.finishLogin(response.data);
          }
        }
      } catch (error) {
        if (error.response?.status === 403 && error.response?.data?.blocked) {
          this.isBlocked = true;
          this.error = '';
          this.emailNotVerified = false;
          this.unverifiedEmail = null;
        } else if (error.response?.status === 403 && error.response?.data?.requireEmailVerify && !error.response?.data?.emailVerified) {
          this.unverifiedEmail = error.response?.data?.email || this.email;
          this.emailNotVerified = true;
          this.error = error.response?.data?.error || 'Email verification required.';
        } else {
          this.error = error.response?.data?.error || 'Login failed. Please check your credentials and try again.';
          this.emailNotVerified = false;
          this.unverifiedEmail = null;
        }
      } finally {
        this.loading = false;
      }
    },
    async handleVerifyOtp() {
      this.error = '';
      this.loading = true;
      try {
        const response = await axios.post(`${orthancApiUrl}api/auth/login-verify-otp`, {
          email: this.otpEmail,
          otp: this.otpCode.trim()
        });
        if (response.data.success) {
          this.finishLogin(response.data);
        }
      } catch (error) {
        this.error = error.response?.data?.error || 'Invalid or expired code. Please try again.';
      } finally {
        this.loading = false;
      }
    },
    async handleResendVerification() {
      if (!this.unverifiedEmail || !this.password) {
        this.error = 'Please enter your email and password, then try to sign in first.';
        return;
      }
      
      this.resendLoading = true;
      this.resendSuccess = false;
      this.error = '';
      
      try {
        // Send as both email and username for backward compatibility
        // Backend will determine which one to use
        const response = await axios.post(`${orthancApiUrl}api/auth/resend-verification-public`, {
          email: this.unverifiedEmail,
          username: this.unverifiedEmail,
          password: this.password
        });
        
        if (response.data.success) {
          this.resendSuccess = true;
          this.error = '';
          // Keep emailNotVerified true until user verifies their email
        }
      } catch (error) {
        if (error.response?.status === 401) {
          this.error = 'Invalid credentials. Please check your email/username and password.';
        } else {
          this.error = error.response?.data?.error || 'Failed to resend verification email. Please try again.';
        }
        this.resendSuccess = false;
      } finally {
        this.resendLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.login-page {
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

.login-page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(74, 144, 226, 0.7) 0%, rgba(53, 122, 189, 0.7) 100%);
  pointer-events: none;
}

.login-container {
  width: 100%;
  max-width: 600px;
  position: relative;
  z-index: 1;
}

.login-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 40px 50px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo {
  height: 70px;
  margin-bottom: 20px;
  object-fit: contain;
}

.login-title {
  color: #1a1f2e;
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.login-subtitle {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}

.login-form {
  width: 100%;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 10px;
  color: #374151;
  font-weight: 500;
  font-size: 15px;
}

.form-control {
  width: 100%;
  padding: 14px 18px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 15px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.form-control:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}

.btn-primary {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.alert-danger {
  padding: 12px 16px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 14px;
}

.alert-blocked {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border: 1px solid #fecaca;
  color: #991b1b;
  border-radius: 12px;
  margin-bottom: 24px;
  font-size: 14px;
}

.alert-blocked i {
  font-size: 24px;
  color: #dc2626;
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-blocked strong {
  display: block;
  font-size: 15px;
  color: #7f1d1d;
}

.alert-blocked p {
  font-size: 13px;
  color: #991b1b;
  line-height: 1.5;
}

.alert-success {
  padding: 12px 16px;
  background: #d1fae5;
  color: #059669;
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 14px;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
}

.login-footer p {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}

.login-footer a {
  color: #4a90e2;
  text-decoration: none;
  font-weight: 600;
}

.login-footer a:hover {
  text-decoration: underline;
}

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

.password-input-wrapper {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.password-toggle:hover {
  color: #4a90e2;
}

.password-toggle:focus {
  outline: none;
}

.password-toggle i {
  font-size: 18px;
}

.otp-email-hint {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 20px;
}

.otp-input {
  text-align: center;
  letter-spacing: 0.25em;
  font-size: 18px;
}

.btn-back {
  display: block;
  width: 100%;
  margin-top: 16px;
  color: #6b7280;
  text-decoration: none;
  font-size: 14px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

.btn-back:hover {
  color: #4a90e2;
  text-decoration: underline;
}
</style>
