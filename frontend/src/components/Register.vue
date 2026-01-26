<template>
  <div class="login-page">
    <div class="login-container">
      <transition name="dialog" appear>
        <div class="login-card" key="register-card">
        <div class="login-header">
          <img class="login-logo" src="../assets/images/emedx-logo.png" alt="EMEDX Logo" />
          <h1 class="login-title">Create Account</h1>
          <p class="login-subtitle">Sign up to get started</p>
        </div>
        
        <form @submit.prevent="handleRegister" class="login-form">
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div v-if="success" class="alert alert-success">{{ success }}</div>
          
          <div class="form-group">
            <label for="username">Username</label>
            <div class="input-with-status">
              <input
                id="username"
                v-model="username"
                type="text"
                class="form-control"
                :class="{ 'is-valid': usernameValid, 'is-invalid': usernameError }"
                placeholder="Choose a username"
                required
                autocomplete="username"
                @input="checkUsernameAvailability"
              />
              <span v-if="checkingUsername" class="input-status checking">
                <i class="bi bi-arrow-repeat spin"></i>
              </span>
              <span v-else-if="usernameValid" class="input-status valid">
                <i class="bi bi-check-circle-fill"></i>
              </span>
              <span v-else-if="usernameError" class="input-status invalid">
                <i class="bi bi-x-circle-fill"></i>
              </span>
            </div>
            <small v-if="usernameError" class="text-danger">{{ usernameError }}</small>
            <small v-else class="text-muted">3-20 characters, letters, numbers and underscores only</small>
          </div>
          
          <div class="form-group">
            <label for="name">Full Name</label>
            <input
              id="name"
              v-model="name"
              type="text"
              class="form-control"
              placeholder="Enter your full name"
              required
              autocomplete="name"
            />
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
            <div class="password-input-wrapper">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="form-control"
                placeholder="Enter your password"
                required
                autocomplete="new-password"
                minlength="6"
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

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <div class="password-input-wrapper">
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                class="form-control"
                placeholder="Confirm your password"
                required
                autocomplete="new-password"
                minlength="6"
              />
              <button
                type="button"
                class="password-toggle"
                @click="showConfirmPassword = !showConfirmPassword"
                :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
              >
                <i :class="showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            <span v-if="loading">Creating account...</span>
            <span v-else>Create Account</span>
          </button>
          
          <div class="login-footer">
            <p>Already have an account? <router-link to="/login">Sign in here</router-link></p>
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
  name: 'Register',
  data() {
    return {
      username: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      error: '',
      success: '',
      loading: false,
      showPassword: false,
      showConfirmPassword: false,
      checkingUsername: false,
      usernameValid: false,
      usernameError: '',
      usernameCheckTimeout: null
    };
  },
  methods: {
    async checkUsernameAvailability() {
      // Clear previous timeout
      if (this.usernameCheckTimeout) {
        clearTimeout(this.usernameCheckTimeout);
      }
      
      this.usernameValid = false;
      this.usernameError = '';
      
      const username = this.username.trim();
      
      // Basic validation
      if (!username) {
        return;
      }
      
      if (username.length < 3) {
        this.usernameError = 'Username must be at least 3 characters';
        return;
      }
      
      if (username.length > 20) {
        this.usernameError = 'Username cannot exceed 20 characters';
        return;
      }
      
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        this.usernameError = 'Only letters, numbers and underscores allowed';
        return;
      }
      
      // Debounce the API call
      this.usernameCheckTimeout = setTimeout(async () => {
        this.checkingUsername = true;
        
        try {
          const response = await axios.get(`${orthancApiUrl}api/auth/check-username/${encodeURIComponent(username)}`);
          
          if (response.data.available) {
            this.usernameValid = true;
            this.usernameError = '';
          } else {
            this.usernameValid = false;
            this.usernameError = response.data.error || 'Username is already taken';
          }
        } catch (error) {
          console.error('Username check error:', error);
        } finally {
          this.checkingUsername = false;
        }
      }, 500);
    },
    
    async handleRegister() {
      this.error = '';
      this.success = '';
      
      // Username validation
      if (!this.username.trim()) {
        this.error = 'Username is required';
        return;
      }
      
      if (!this.usernameValid) {
        this.error = this.usernameError || 'Please enter a valid username';
        return;
      }
      
      // Validation
      if (this.password !== this.confirmPassword) {
        this.error = 'Passwords do not match';
        return;
      }
      
      if (this.password.length < 6) {
        this.error = 'Password must be at least 6 characters long';
        return;
      }
      
      this.loading = true;
      
      try {
        const response = await axios.post(`${orthancApiUrl}api/auth/register`, {
          username: this.username.trim(),
          name: this.name,
          email: this.email,
          password: this.password
        });
        
        if (response.data.success) {
          // Store token and user data
          if (response.data.token) {
            localStorage.setItem('auth-token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
          }
          
          this.success = response.data.message || 'Account created successfully! Please check your email to verify your account.';
          
          // Redirect to login after a delay
          setTimeout(() => {
            this.$router.push('/login');
          }, 3000);
        }
      } catch (error) {
        this.error = error.response?.data?.error || 'Registration failed. Please try again.';
      } finally {
        this.loading = false;
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
  border-radius: 10px;
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
  transform: translateY(0) scale(1);
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
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 14px;
}

.alert-success {
  padding: 12px 16px;
  background: #d1fae5;
  color: #059669;
  border-radius: 10px;
  margin-bottom: 20px;
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

.input-with-status {
  position: relative;
}

.input-with-status .form-control {
  padding-right: 40px;
}

.input-status {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.input-status.checking {
  color: #6b7280;
}

.input-status.valid {
  color: #059669;
}

.input-status.invalid {
  color: #dc2626;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.form-control.is-valid {
  border-color: #059669;
}

.form-control.is-valid:focus {
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
}

.form-control.is-invalid {
  border-color: #dc2626;
}

.form-control.is-invalid:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.text-danger {
  color: #dc2626;
  font-size: 12px;
  margin-top: 4px;
  display: block;
}

.text-muted {
  color: #6b7280;
  font-size: 12px;
  margin-top: 4px;
  display: block;
}
</style>
