<template>
  <div class="login-page">
    <div class="login-container">
      <transition name="dialog" appear>
        <div class="login-card" key="login-card">
          <div class="login-header">
            <img class="login-logo" src="../assets/images/emedx-logo.png" alt="EMEDX Logo" />
            <h1 class="login-title">Welcome Back</h1>
            <p class="login-subtitle">Sign in to continue to your account</p>
          </div>
          
          <form @submit.prevent="handleLogin" class="login-form">
            <div v-if="error" class="alert alert-danger">
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
              <label for="email">Email Address</label>
              <input
                id="email"
                v-model="email"
                type="email"
                class="form-control"
                placeholder="Enter your email"
                required
                autocomplete="email"
              />
            </div>
            
            <div class="form-group">
              <label for="password">Password</label>
              <input
                id="password"
                v-model="password"
                type="password"
                class="form-control"
                placeholder="Enter your password"
                required
                autocomplete="current-password"
              />
            </div>
            
            <button type="submit" class="btn btn-primary btn-block" :disabled="loading || emailNotVerified">
              <span v-if="loading">Signing in...</span>
              <span v-else>Sign In</span>
            </button>
            
            <div class="login-footer">
              <p>Don't have an account? <router-link to="/register">Register here</router-link></p>
            </div>
          </form>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { orthancApiUrl } from '../globalConfigurations';

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
      emailNotVerified: false
    };
  },
  methods: {
    async handleLogin() {
      this.error = '';
      this.emailNotVerified = false;
      this.loading = true;
      
      try {
        const response = await axios.post(`${orthancApiUrl}api/auth/login`, {
          email: this.email,
          password: this.password
        });
        
        if (response.data.success) {
          // Backend already checks REQUIRE_VERIFY_EMAIL setting
          // If we get here, login is allowed (either email is verified or verification is not required)
          
          // Store token and user data
          localStorage.setItem('auth-token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          
          // Redirect to home
          this.$router.push('/');
        }
      } catch (error) {
        this.error = error.response?.data?.error || 'Login failed. Please try again.';
        
        // If backend requires email verification and email is not verified, show resend option
        if (error.response?.status === 403 && error.response?.data?.requireEmailVerify && !error.response?.data?.emailVerified) {
          this.unverifiedEmail = this.email;
          this.emailNotVerified = true;
        } else {
          this.emailNotVerified = false;
          this.unverifiedEmail = null;
        }
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
        const response = await axios.post(`${orthancApiUrl}api/auth/resend-verification-public`, {
          email: this.unverifiedEmail,
          password: this.password
        });
        
        if (response.data.success) {
          this.resendSuccess = true;
          this.error = '';
          // Keep emailNotVerified true until user verifies their email
        }
      } catch (error) {
        if (error.response?.status === 401) {
          this.error = 'Invalid credentials. Please check your email and password.';
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
</style>
