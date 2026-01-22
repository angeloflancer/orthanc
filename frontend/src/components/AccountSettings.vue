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
              <label for="username" class="form-label">Username</label>
              <div class="input-with-status">
                <input 
                  type="text" 
                  class="form-control" 
                  :class="{ 'is-valid': usernameValid && userProfile.username !== originalUsername, 'is-invalid': usernameError }"
                  id="username" 
                  v-model="userProfile.username"
                  required
                  placeholder="Enter your username"
                  @input="checkUsernameAvailability"
                />
                <span v-if="checkingUsername" class="input-status checking">
                  <i class="bi bi-arrow-repeat spin"></i>
                </span>
                <span v-else-if="usernameValid && userProfile.username !== originalUsername" class="input-status valid">
                  <i class="bi bi-check-circle-fill"></i>
                </span>
                <span v-else-if="usernameError" class="input-status invalid">
                  <i class="bi bi-x-circle-fill"></i>
                </span>
              </div>
              <small v-if="usernameError" class="text-danger">{{ usernameError }}</small>
            </div>
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
              <label class="form-label">Role</label>
              <div class="role-display">
                <span class="role-badge" :class="userProfile.role">
                  <i :class="getRoleIcon(userProfile.role)" class="me-1"></i>
                  {{ formatRole(userProfile.role) }}
                </span>
              </div>
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
              <button type="submit" class="btn btn-primary" :disabled="profileLoading || (usernameError && userProfile.username !== originalUsername)">
                <span v-if="profileLoading" class="spinner-border spinner-border-sm me-2"></span>
                {{ profileLoading ? 'Updating...' : 'Update Profile' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Hospital Membership Section (for doctors only) -->
      <div v-if="userProfile.role === 'doctor'" class="card mb-4 shadow-sm">
        <div class="card-body">
          <h5 class="card-title mb-4">
            <i class="bi bi-hospital me-2"></i>Hospital Membership
          </h5>
          
          <!-- Pending Invitation (Admin invited) -->
          <div v-if="hospitalMembership && hospitalMembership.status === 'pending_invitation'" class="invitation-card mb-4">
            <div class="alert alert-info d-flex align-items-start">
              <i class="bi bi-envelope-paper me-3 fs-4"></i>
              <div class="flex-grow-1">
                <h6 class="alert-heading mb-2">
                  <i class="bi bi-bell me-2"></i>Hospital Invitation
                </h6>
                <p class="mb-2">
                  <strong>{{ hospitalMembership.hospital.name }}</strong> has invited you to join their hospital.
                </p>
                <div class="invitation-details mb-3">
                  <p class="mb-1"><strong>Hospital ID:</strong> {{ hospitalMembership.hospital.hospitalId }}</p>
                  <p v-if="hospitalMembership.hospital.address" class="mb-1">
                    <strong>Address:</strong> {{ hospitalMembership.hospital.address }}
                  </p>
                  <p v-if="hospitalMembership.invitedBy" class="mb-0 text-muted small">
                    <i class="bi bi-person me-1"></i>Invited by: {{ hospitalMembership.invitedBy.name || hospitalMembership.invitedBy.username }}
                  </p>
                </div>
                <div class="invitation-actions d-flex gap-2">
                  <button 
                    class="btn btn-success"
                    @click="acceptInvitation"
                    :disabled="invitationLoading"
                  >
                    <span v-if="invitationLoading" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-check-circle me-2"></i>
                    Accept Invitation
                  </button>
                  <button 
                    class="btn btn-outline-danger"
                    @click="rejectInvitation"
                    :disabled="invitationLoading"
                  >
                    <span v-if="invitationLoading" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-x-circle me-2"></i>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Current Membership Status -->
          <div v-if="hospitalMembership && hospitalMembership.status !== 'pending_invitation'" class="membership-info mb-4">
            <div class="membership-card" :class="hospitalMembership.status">
              <div class="membership-header">
                <h6 class="mb-0">{{ hospitalMembership.hospital.name }}</h6>
                <span class="membership-status" :class="hospitalMembership.status">
                  {{ formatMembershipStatus(hospitalMembership.status) }}
                </span>
              </div>
              <div class="membership-details">
                <p class="mb-1"><strong>Hospital ID:</strong> {{ hospitalMembership.hospital.hospitalId }}</p>
                <p v-if="hospitalMembership.hospital.address" class="mb-1">
                  <strong>Address:</strong> {{ hospitalMembership.hospital.address }}
                </p>
                <p v-if="hospitalMembership.joinedAt" class="mb-0">
                  <strong>Joined:</strong> {{ formatDate(hospitalMembership.joinedAt) }}
                </p>
              </div>
              <div class="membership-actions" v-if="hospitalMembership.status === 'pending' || hospitalMembership.status === 'accepted'">
                <button 
                  class="btn btn-outline-danger btn-sm"
                  @click="leaveHospital"
                  :disabled="leaveLoading"
                >
                  <span v-if="leaveLoading" class="spinner-border spinner-border-sm me-1"></span>
                  {{ hospitalMembership.status === 'pending' ? 'Cancel Request' : 'Leave Hospital' }}
                </button>
              </div>
            </div>
          </div>
          
          <!-- Join Hospital Form (only if not a member or kicked) -->
          <div v-if="!hospitalMembership || hospitalMembership.status === 'kicked'">
            <p class="text-muted mb-3">
              <i class="bi bi-info-circle me-1"></i>
              Enter a hospital ID to request membership. The hospital admin will need to approve your request.
            </p>
            <form @submit.prevent="joinHospital">
              <div class="form-row mb-3">
                <label for="hospitalId" class="form-label">Hospital ID</label>
                <input 
                  type="text" 
                  class="form-control" 
                  id="hospitalId" 
                  v-model="joinHospitalId"
                  placeholder="e.g., HSP-A1B2C3"
                  pattern="HSP-[A-Za-z0-9]{6}"
                />
              </div>
              <div v-if="hospitalSuccess || hospitalError" class="form-row">
                <div class="form-label"></div>
                <div class="alert-wrapper">
                  <div v-if="hospitalSuccess" class="alert alert-success alert-dismissible fade show" role="alert">
                    <i class="bi bi-check-circle me-2"></i>{{ hospitalSuccess }}
                    <button type="button" class="btn-close" @click="hospitalSuccess = ''"></button>
                  </div>
                  <div v-if="hospitalError" class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i class="bi bi-exclamation-circle me-2"></i>{{ hospitalError }}
                    <button type="button" class="btn-close" @click="hospitalError = ''"></button>
                  </div>
                </div>
              </div>
              <div class="form-row">
                <div class="form-label"></div>
                <button type="submit" class="btn btn-primary" :disabled="joinLoading || !joinHospitalId">
                  <span v-if="joinLoading" class="spinner-border spinner-border-sm me-2"></span>
                  {{ joinLoading ? 'Joining...' : 'Request to Join' }}
                </button>
              </div>
            </form>
          </div>
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
        username: '',
        name: '',
        email: '',
        role: 'doctor',
        emailVerified: false
      },
      originalUsername: '',
      passwordForm: {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      },
      hospitalMembership: null,
      joinHospitalId: '',
      profileLoading: false,
      passwordLoading: false,
      resendLoading: false,
      joinLoading: false,
      leaveLoading: false,
      invitationLoading: false,
      profileSuccess: '',
      profileError: '',
      passwordSuccess: '',
      passwordError: '',
      hospitalSuccess: '',
      hospitalError: '',
      showCurrentPassword: false,
      showNewPassword: false,
      showConfirmPassword: false,
      checkingUsername: false,
      usernameValid: true,
      usernameError: '',
      usernameCheckTimeout: null
    };
  },
  async mounted() {
    await this.loadUserProfile();
    await this.loadMembership();
  },
  methods: {
    async checkUsernameAvailability() {
      // Clear previous timeout
      if (this.usernameCheckTimeout) {
        clearTimeout(this.usernameCheckTimeout);
      }
      
      this.usernameValid = false;
      this.usernameError = '';
      
      const username = this.userProfile.username?.trim();
      
      // If username is same as original, it's valid
      if (username === this.originalUsername) {
        this.usernameValid = true;
        return;
      }
      
      // Basic validation
      if (!username) {
        this.usernameError = 'Username is required';
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
          this.originalUsername = response.data.user.username;
          this.usernameValid = true;
          
          // Set hospital membership if available
          if (response.data.user.hospitalMembership) {
            this.hospitalMembership = {
              hospital: {
                hospitalId: response.data.user.hospitalMembership.hospitalId,
                name: response.data.user.hospitalMembership.hospitalName
              },
              status: response.data.user.hospitalMembership.status
            };
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('auth-token');
          this.$router.push('/login');
        }
      }
    },
    
    async loadMembership() {
      if (this.userProfile.role !== 'doctor') return;
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.get(`${orthancApiUrl}api/members/my-membership`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data.success && response.data.membership) {
          this.hospitalMembership = response.data.membership;
        }
      } catch (error) {
        console.error('Error loading membership:', error);
      }
    },
    
    async updateProfile() {
      // Validate username if changed
      if (this.userProfile.username !== this.originalUsername && !this.usernameValid) {
        this.profileError = this.usernameError || 'Please enter a valid username';
        return;
      }
      
      this.profileLoading = true;
      this.profileError = '';
      this.profileSuccess = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.put(
          `${orthancApiUrl}api/auth/profile`,
          {
            username: this.userProfile.username,
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
          this.userProfile = { ...this.userProfile, ...response.data.user };
          this.originalUsername = response.data.user.username;
          
          // Update localStorage
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...storedUser, ...response.data.user }));
          
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
    
    async joinHospital() {
      if (!this.joinHospitalId) {
        this.hospitalError = 'Please enter a hospital ID';
        return;
      }
      
      this.joinLoading = true;
      this.hospitalError = '';
      this.hospitalSuccess = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.post(
          `${orthancApiUrl}api/members/join`,
          { hospitalId: this.joinHospitalId.trim().toUpperCase() },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.hospitalSuccess = response.data.message || 'Join request sent successfully!';
          this.joinHospitalId = '';
          await this.loadMembership();
          
          setTimeout(() => {
            this.hospitalSuccess = '';
          }, 5000);
        }
      } catch (error) {
        this.hospitalError = error.response?.data?.error || 'Failed to join hospital. Please try again.';
      } finally {
        this.joinLoading = false;
      }
    },
    
    async leaveHospital() {
      if (!confirm('Are you sure you want to leave this hospital?')) {
        return;
      }
      
      this.leaveLoading = true;
      this.hospitalError = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.delete(`${orthancApiUrl}api/members/leave`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          this.hospitalMembership = null;
          this.hospitalSuccess = 'You have left the hospital.';
          
          setTimeout(() => {
            this.hospitalSuccess = '';
          }, 3000);
        }
      } catch (error) {
        this.hospitalError = error.response?.data?.error || 'Failed to leave hospital. Please try again.';
      } finally {
        this.leaveLoading = false;
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
    },
    
    formatRole(role) {
      const roles = {
        doctor: 'Doctor',
        admin: 'Admin',
        owner: 'Owner'
      };
      return roles[role] || role;
    },
    
    getRoleIcon(role) {
      const icons = {
        doctor: 'bi bi-person-badge',
        admin: 'bi bi-building',
        owner: 'bi bi-shield-check'
      };
      return icons[role] || 'bi bi-person';
    },
    
    async acceptInvitation() {
      if (!confirm('Are you sure you want to accept this invitation?')) {
        return;
      }
      
      this.invitationLoading = true;
      this.hospitalError = '';
      this.hospitalSuccess = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.put(
          `${orthancApiUrl}api/members/accept-invitation`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.hospitalSuccess = response.data.message || 'Invitation accepted successfully!';
          await this.loadMembership();
          
          setTimeout(() => {
            this.hospitalSuccess = '';
          }, 3000);
        }
      } catch (error) {
        this.hospitalError = error.response?.data?.error || 'Failed to accept invitation. Please try again.';
      } finally {
        this.invitationLoading = false;
      }
    },
    
    async rejectInvitation() {
      if (!confirm('Are you sure you want to reject this invitation? This action cannot be undone.')) {
        return;
      }
      
      this.invitationLoading = true;
      this.hospitalError = '';
      this.hospitalSuccess = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.put(
          `${orthancApiUrl}api/members/reject-invitation`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.hospitalMembership = null;
          this.hospitalSuccess = response.data.message || 'Invitation rejected successfully.';
          
          setTimeout(() => {
            this.hospitalSuccess = '';
          }, 3000);
        }
      } catch (error) {
        this.hospitalError = error.response?.data?.error || 'Failed to reject invitation. Please try again.';
      } finally {
        this.invitationLoading = false;
      }
    },
    
    formatMembershipStatus(status) {
      const statuses = {
        pending: 'Pending Approval',
        pending_invitation: 'Pending Invitation',
        accepted: 'Active Member',
        kicked: 'Removed',
        blocked: 'Blocked'
      };
      return statuses[status] || status;
    },
    
    formatDate(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
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

/* Username validation styles */
.input-with-status {
  position: relative;
  flex: 1;
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
  flex: 1;
  margin-left: 156px;
}

.text-muted {
  color: #6b7280;
  font-size: 13px;
}

/* Role badge styles */
.role-display {
  flex: 1;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
}

.role-badge.doctor {
  background-color: #e0f2fe;
  color: #0369a1;
}

.role-badge.admin {
  background-color: #fef3c7;
  color: #92400e;
}

.role-badge.owner {
  background-color: #ede9fe;
  color: #6b21a8;
}

/* Hospital membership styles */
.membership-info {
  margin-bottom: 20px;
}

.membership-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e5e7eb;
}

.membership-card.accepted {
  border-left: 4px solid #059669;
}

.membership-card.pending {
  border-left: 4px solid #f59e0b;
}

.membership-card.blocked {
  border-left: 4px solid #dc2626;
}

.membership-card.kicked {
  border-left: 4px solid #6b7280;
}

.membership-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.membership-header h6 {
  font-weight: 600;
  color: #1f2937;
}

.membership-status {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.membership-status.accepted {
  background-color: #d1fae5;
  color: #065f46;
}

.membership-status.pending {
  background-color: #fef3c7;
  color: #92400e;
}

.membership-status.blocked {
  background-color: #fee2e2;
  color: #991b1b;
}

.membership-status.kicked {
  background-color: #f3f4f6;
  color: #4b5563;
}

.membership-status.pending_invitation {
  background-color: #dbeafe;
  color: #1e40af;
}

.membership-card.pending_invitation {
  border-left: 4px solid #3b82f6;
}

.invitation-card {
  margin-bottom: 24px;
}

.invitation-card .alert {
  border-radius: 12px;
  border: 1px solid #bfdbfe;
  background-color: #eff6ff;
}

.invitation-card .alert-heading {
  color: #1e40af;
  font-weight: 600;
}

.invitation-details {
  background-color: #ffffff;
  padding: 12px;
  border-radius: 8px;
  margin-top: 12px;
  border: 1px solid #dbeafe;
}

.invitation-actions {
  margin-top: 16px;
}

.invitation-actions .btn {
  min-width: 140px;
}

.membership-details {
  font-size: 0.875rem;
  color: #4b5563;
  margin-bottom: 16px;
}

.membership-details p {
  margin-bottom: 4px;
}

.membership-actions {
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.btn-outline-danger {
  color: #dc2626;
  border-color: #dc2626;
}

.btn-outline-danger:hover {
  background-color: #dc2626;
  color: white;
}
</style>
