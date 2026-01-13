<template>
  <div class="account-settings">
    <div class="container-fluid py-4">
      <h2 class="mb-4">Account Settings</h2>
      
      <!-- Profile Section -->
      <div class="card mb-4 shadow-sm">
        <div class="card-body">
          <h5 class="card-title mb-4">
            <i class="bi bi-person-circle me-2"></i>User Profile
          </h5>
          <form @submit.prevent="updateProfile">
            <div class="form-row mb-3">
              <label for="name" class="form-label">Name</label>
              <input 
                type="text" 
                class="form-control" 
                id="name" 
                v-model="userProfile.name"
                required
                placeholder="Enter your name"
              />
            </div>
            <div class="form-row mb-3">
              <label for="email" class="form-label">Email Address</label>
              <input 
                type="email" 
                class="form-control" 
                id="email" 
                v-model="userProfile.email"
                required
                placeholder="Enter your email"
              />
            </div>
            <div class="form-row mb-3">
              <label class="form-label">Email Verification</label>
              <div class="verification-status">
                <span v-if="userProfile.emailVerified" class="status-badge verified">
                  <i class="bi bi-check-circle me-1"></i> Verified
                </span>
                <div v-else class="verification-unverified">
                  <span class="status-badge not-verified">
                    <i class="bi bi-exclamation-circle me-1"></i> Not Verified
                  </span>
                  <button 
                    type="button" 
                    class="btn-resend"
                    @click="resendVerification"
                    :disabled="resendLoading"
                  >
                    <span v-if="resendLoading" class="spinner-border spinner-border-sm me-1"></span>
                    {{ resendLoading ? 'Sending...' : 'Resend Email' }}
                  </button>
                </div>
                <div v-if="!userProfile.emailVerified" class="verification-hint">
                  <i class="bi bi-info-circle me-1"></i>
                  Please verify your email address to access all features.
                </div>
              </div>
            </div>
            <div v-if="profileSuccess || profileError" class="form-row">
              <div class="form-label"></div>
              <div class="alert-wrapper">
                <div v-if="profileSuccess" class="alert alert-success alert-dismissible fade show" role="alert">
                  <i class="bi bi-check-circle me-2"></i>{{ profileSuccess }}
                  <button type="button" class="btn-close" @click="profileSuccess = ''"></button>
                </div>
                <div v-if="profileError" class="alert alert-danger alert-dismissible fade show" role="alert">
                  <i class="bi bi-exclamation-circle me-2"></i>{{ profileError }}
                  <button type="button" class="btn-close" @click="profileError = ''"></button>
                </div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-label"></div>
              <button type="submit" class="btn btn-primary" :disabled="profileLoading">
                <span v-if="profileLoading" class="spinner-border spinner-border-sm me-2"></span>
                {{ profileLoading ? 'Updating...' : 'Update Profile' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Change Password Section -->
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title mb-4">
            <i class="bi bi-shield-lock me-2"></i>Change Password
          </h5>
          <form @submit.prevent="changePassword">
            <div class="form-row mb-3">
              <label for="currentPassword" class="form-label">Current Password</label>
              <div class="password-input-wrapper">
                <input 
                  :type="showCurrentPassword ? 'text' : 'password'"
                  class="form-control" 
                  id="currentPassword" 
                  v-model="passwordForm.currentPassword"
                  required
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  class="password-toggle"
                  @click="showCurrentPassword = !showCurrentPassword"
                  :aria-label="showCurrentPassword ? 'Hide password' : 'Show password'"
                >
                  <i :class="showCurrentPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                </button>
              </div>
            </div>
            <div class="form-row mb-3">
              <label for="newPassword" class="form-label">New Password</label>
              <div class="password-input-wrapper">
                <input 
                  :type="showNewPassword ? 'text' : 'password'"
                  class="form-control" 
                  id="newPassword" 
                  v-model="passwordForm.newPassword"
                  required
                  minlength="6"
                  placeholder="Enter new password (min. 6 characters)"
                />
                <button
                  type="button"
                  class="password-toggle"
                  @click="showNewPassword = !showNewPassword"
                  :aria-label="showNewPassword ? 'Hide password' : 'Show password'"
                >
                  <i :class="showNewPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                </button>
              </div>
            </div>
            <div class="form-row mb-3">
              <label for="confirmPassword" class="form-label">Confirm New Password</label>
              <div class="password-input-wrapper">
                <input 
                  :type="showConfirmPassword ? 'text' : 'password'"
                  class="form-control" 
                  id="confirmPassword" 
                  v-model="passwordForm.confirmPassword"
                  required
                  placeholder="Confirm new password"
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
            <div v-if="passwordSuccess || passwordError" class="form-row">
              <div class="form-label"></div>
              <div class="alert-wrapper">
                <div v-if="passwordSuccess" class="alert alert-success alert-dismissible fade show" role="alert">
                  <i class="bi bi-check-circle me-2"></i>{{ passwordSuccess }}
                  <button type="button" class="btn-close" @click="passwordSuccess = ''"></button>
                </div>
                <div v-if="passwordError" class="alert alert-danger alert-dismissible fade show" role="alert">
                  <i class="bi bi-exclamation-circle me-2"></i>{{ passwordError }}
                  <button type="button" class="btn-close" @click="passwordError = ''"></button>
                </div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-label"></div>
              <button type="submit" class="btn btn-primary" :disabled="passwordLoading">
                <span v-if="passwordLoading" class="spinner-border spinner-border-sm me-2"></span>
                {{ passwordLoading ? 'Changing...' : 'Change Password' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { orthancApiUrl } from '../globalConfigurations';

export default {
  name: 'AccountSettings',
  data() {
    return {
      userProfile: {
        name: '',
        email: '',
        emailVerified: false
      },
      passwordForm: {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      },
      profileLoading: false,
      passwordLoading: false,
      resendLoading: false,
      profileSuccess: '',
      profileError: '',
      passwordSuccess: '',
      passwordError: '',
      showCurrentPassword: false,
      showNewPassword: false,
      showConfirmPassword: false
    };
  },
  async mounted() {
    await this.loadUserProfile();
  },
  methods: {
    async loadUserProfile() {
      try {
        const token = localStorage.getItem('auth-token');
        if (!token) {
          this.$router.push('/login');
          return;
        }
        
        const response = await axios.get(`${orthancApiUrl}api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          this.userProfile = response.data.user;
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        if (error.response?.status === 401) {
          localStorage.removeItem('auth-token');
          this.$router.push('/login');
        }
      }
    },
    async updateProfile() {
      this.profileLoading = true;
      this.profileError = '';
      this.profileSuccess = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.put(
          `${orthancApiUrl}api/auth/profile`,
          {
            name: this.userProfile.name,
            email: this.userProfile.email
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.profileSuccess = response.data.message || 'Profile updated successfully!';
          this.userProfile = response.data.user;
          // Clear form after successful update
          setTimeout(() => {
            this.profileSuccess = '';
          }, 3000);
        }
      } catch (error) {
        this.profileError = error.response?.data?.error || 'Failed to update profile. Please try again.';
      } finally {
        this.profileLoading = false;
      }
    },
    async changePassword() {
      // Validate passwords match
      if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
        this.passwordError = 'New passwords do not match';
        return;
      }
      
      if (this.passwordForm.newPassword.length < 6) {
        this.passwordError = 'New password must be at least 6 characters long';
        return;
      }
      
      this.passwordLoading = true;
      this.passwordError = '';
      this.passwordSuccess = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.put(
          `${orthancApiUrl}api/auth/change-password`,
          {
            currentPassword: this.passwordForm.currentPassword,
            newPassword: this.passwordForm.newPassword
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.passwordSuccess = response.data.message || 'Password changed successfully!';
          // Clear form after successful password change
          this.passwordForm = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          };
          setTimeout(() => {
            this.passwordSuccess = '';
          }, 3000);
        }
      } catch (error) {
        this.passwordError = error.response?.data?.error || 'Failed to change password. Please try again.';
      } finally {
        this.passwordLoading = false;
      }
    },
    async resendVerification() {
      this.resendLoading = true;
      this.profileError = '';
      this.profileSuccess = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.post(
          `${orthancApiUrl}api/auth/resend-verification`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.profileSuccess = response.data.message || 'Verification email sent! Please check your inbox.';
          setTimeout(() => {
            this.profileSuccess = '';
          }, 5000);
        }
      } catch (error) {
        this.profileError = error.response?.data?.error || 'Failed to resend verification email. Please try again.';
      } finally {
        this.resendLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.account-settings {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.account-settings .container-fluid {
  max-width: 600px;
  width: 100%;
}

.card {
  border: none;
  border-radius: 12px;
  transition: box-shadow 0.3s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
}

.card-title {
  font-weight: 600;
  color: #374151;
  font-size: 1.1rem;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.form-row .form-label {
  flex: 0 0 140px;
  font-weight: 500;
  color: #4b5563;
  margin-bottom: 0;
  text-align: right;
}

.form-row .form-control,
.form-row .verification-status {
  flex: 1;
  min-width: 0;
}

.form-control {
  border-radius: 8px;
  border: 1px solid #d1d5db;
  padding: 10px 14px;
  transition: all 0.2s ease;
}

.form-control:focus {
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  outline: none;
}

.password-input-wrapper {
  position: relative;
  flex: 1;
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

.verification-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.verification-unverified {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
  white-space: nowrap;
}

.status-badge.verified {
  background-color: #d1fae5;
  color: #065f46;
}

.status-badge.not-verified {
  background-color: #fef3c7;
  color: #92400e;
}

.btn-resend {
  background-color: transparent;
  border: 1px solid #4a90e2;
  color: #4a90e2;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.btn-resend:hover:not(:disabled) {
  background-color: #4a90e2;
  color: white;
}

.btn-resend:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.verification-hint {
  font-size: 0.8125rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  margin-top: 4px;
}

.btn-primary {
  background-color: #4a90e2;
  border-color: #4a90e2;
  border-radius: 8px;
  padding: 10px 24px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background-color: #357abd;
  border-color: #357abd;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(74, 144, 226, 0.2);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.alert-wrapper {
  flex: 1;
  min-width: 0;
}

.alert {
  border-radius: 8px;
  border: none;
  padding: 12px 16px;
  margin-bottom: 0;
}

.alert-success {
  background-color: #d1fae5;
  color: #065f46;
}

.alert-danger {
  background-color: #fee2e2;
  color: #991b1b;
}

.shadow-sm {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .form-row .form-label {
    flex: none;
    text-align: left;
    width: 100%;
  }
  
  .form-row .form-control,
  .form-row .verification-status {
    width: 100%;
  }
  
  .verification-unverified {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
