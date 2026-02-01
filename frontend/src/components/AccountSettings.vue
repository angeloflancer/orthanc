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
              <div v-if="!isEditingProfile" class="field-display">
                <span class="field-value">{{ userProfile.username }}</span>
              </div>
              <div v-else class="input-with-status">
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
              <small v-if="isEditingProfile && usernameError" class="text-danger">{{ usernameError }}</small>
            </div>
            <div class="form-row mb-3">
              <label for="name" class="form-label">Name</label>
              <div v-if="!isEditingProfile" class="field-display">
                <span class="field-value">{{ userProfile.name }}</span>
              </div>
              <input 
                v-else
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
              <div v-if="!isEditingProfile" class="field-display">
                <span class="field-value">{{ userProfile.email }}</span>
              </div>
              <input 
                v-else
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
                <span class="text-muted small ms-2">Role cannot be changed.</span>
              </div>
            </div>
            <div class="form-row mb-3">
              <label class="form-label">Email Verification</label>
              <div class="verification-status">
                <!-- Loading state while fetching profile data -->
                <div v-if="profileDataLoading" class="verification-loading">
                  <span class="spinner-border spinner-border-sm me-2"></span>
                  <span>Loading verification status...</span>
                </div>
                <!-- Verified state -->
                <span v-else-if="userProfile.emailVerified" class="status-badge verified">
                  <i class="bi bi-check-circle me-1"></i> Verified
                </span>
                <!-- Not verified state -->
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
                <div v-if="!profileDataLoading && !userProfile.emailVerified" class="verification-hint">
                  <i class="bi bi-info-circle me-1"></i>
                  Please verify your email address to edit your profile, change your role, join a hospital, or change your password.
                </div>
              </div>
            </div>
            <!-- Email Verification Warning for Edit Button -->
            <div v-if="!profileDataLoading && !userProfile.emailVerified && !isEditingProfile" class="verification-notice mb-3">
              <div class="verification-notice-content">
                <i class="bi bi-shield-exclamation verification-notice-icon"></i>
                <span class="verification-notice-text">
                  Verify your email to edit your profile
                </span>
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
              <div class="profile-actions">
                <button 
                  v-if="!isEditingProfile"
                  type="button" 
                  class="btn btn-primary"
                  @click="startEditingProfile"
                  :disabled="profileDataLoading || !userProfile.emailVerified"
                >
                  <i class="bi bi-pencil me-2"></i>Edit Profile
                </button>
                <template v-else>
                  <button 
                    type="submit" 
                    class="btn btn-primary"
                    :disabled="!canSaveProfile"
                  >
                    <span v-if="profileLoading" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-check-lg me-2"></i>
                    {{ profileLoading ? 'Saving...' : 'Save Changes' }}
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-outline-secondary ms-2"
                    @click="cancelEditingProfile"
                    :disabled="profileLoading"
                  >
                    <i class="bi bi-x-lg me-2"></i>Cancel
                  </button>
                </template>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Subscription Status Section (for admins only) -->
      <div v-if="userProfile.role === 'admin'" class="card mb-4 shadow-sm">
        <div class="card-body">
          <h5 class="card-title mb-4">
            <i class="bi bi-calendar-check me-2"></i>Subscription Status
          </h5>
          
          <div v-if="subscriptionInfo" class="subscription-details">
            <div class="subscription-badge mb-3">
              <span class="badge" :class="getSubscriptionBadgeClass()">
                <i :class="getSubscriptionIcon()" class="me-1"></i>
                {{ getSubscriptionPlanName() }}
              </span>
            </div>
            
            <div v-if="subscriptionInfo.planType !== 'forever'" class="expiration-details">
              <div class="detail-row">
                <span class="detail-label"><i class="bi bi-clock me-1"></i>Expires:</span>
                <span class="detail-value">{{ formatDate(subscriptionInfo.expiresAt) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label"><i class="bi bi-calendar-x me-1"></i>Days Remaining:</span>
                <span class="detail-value" :class="getDaysRemainingClass()">
                  {{ subscriptionInfo.daysUntilExpiration !== null ? Math.max(0, subscriptionInfo.daysUntilExpiration) : 'N/A' }}
                </span>
              </div>
            </div>
            
            <div v-else class="forever-plan-info">
              <i class="bi bi-infinity me-2"></i>
              <span>Unlimited access - No expiration</span>
            </div>
            
            <div v-if="subscriptionInfo.shouldShowWarning" class="warning-alert mt-3">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              <span>There are {{ Math.max(0, subscriptionInfo.daysUntilExpiration) }} days left until the deadline. Please contact the administrator to extend the deadline.</span>
            </div>
            
            <div v-if="!subscriptionInfo.isActive && subscriptionInfo.planType !== 'forever'" class="expired-alert mt-3">
              <i class="bi bi-x-circle-fill me-2"></i>
              <span>Subscription has expired. Contact the owner to renew.</span>
            </div>
          </div>
          
          <div v-else class="no-subscription-info">
            <i class="bi bi-info-circle me-2"></i>
            <span>No subscription found. Please contact the owner.</span>
          </div>
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
                    :disabled="profileDataLoading || invitationLoading || !userProfile.emailVerified"
                  >
                    <span v-if="invitationLoading" class="spinner-border spinner-border-sm me-2"></span>
                    <i v-else class="bi bi-check-circle me-2"></i>
                    Accept Invitation
                  </button>
                  <button 
                    class="btn btn-outline-danger"
                    @click="rejectInvitation"
                    :disabled="profileDataLoading || invitationLoading || !userProfile.emailVerified"
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
              
              <!-- Hospital Subscription Status (for accepted members) -->
              <div v-if="hospitalMembership.status === 'accepted' && doctorSubscription" class="hospital-subscription-info mt-3 pt-3 border-top">
                <h6 class="mb-2">
                  <i class="bi bi-calendar-check me-2"></i>Hospital Subscription
                </h6>
                <div class="subscription-badge mb-2">
                  <span class="badge" :class="getDoctorSubscriptionBadgeClass()">
                    <i :class="getDoctorSubscriptionIcon()" class="me-1"></i>
                    {{ getDoctorSubscriptionPlanName() }}
                  </span>
                </div>
                <div v-if="doctorSubscription.planType !== 'forever'" class="expiration-details">
                  <div class="detail-row">
                    <span class="detail-label"><i class="bi bi-clock me-1"></i>Expires:</span>
                    <span class="detail-value">{{ formatDate(doctorSubscription.expiresAt) }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label"><i class="bi bi-calendar-x me-1"></i>Days Remaining:</span>
                    <span class="detail-value" :class="getDoctorDaysRemainingClass()">
                      {{ doctorSubscription.daysUntilExpiration !== null ? Math.max(0, doctorSubscription.daysUntilExpiration) : 'N/A' }}
                    </span>
                  </div>
                </div>
                <div v-else class="forever-plan-info">
                  <i class="bi bi-infinity me-2"></i>
                  <span>Unlimited access - No expiration</span>
                </div>
                <div v-if="doctorSubscription.shouldShowWarning" class="warning-alert mt-2">
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>
                  <span>There are {{ Math.max(0, doctorSubscription.daysUntilExpiration) }} days left until the deadline. Please contact the administrator to extend the deadline.</span>
                </div>
                <div v-if="!doctorSubscription.isActive && doctorSubscription.planType !== 'forever'" class="expired-alert mt-2">
                  <i class="bi bi-x-circle-fill me-2"></i>
                  <span>Hospital is currently suspended. Wait for the administrator to renew.</span>
                </div>
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
            <div v-if="!userProfile.emailVerified" class="verification-blocker mb-3">
              <div class="verification-blocker-content">
                <i class="bi bi-shield-exclamation verification-blocker-icon"></i>
                <div class="verification-blocker-text">
                  <p class="verification-blocker-message mb-0">
                    Please verify your email address to join a hospital.
                  </p>
                </div>
              </div>
            </div>
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
                  :disabled="profileDataLoading || !userProfile.emailVerified"
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
                <button type="submit" class="btn btn-primary" :disabled="profileDataLoading || joinLoading || !joinHospitalId || !userProfile.emailVerified">
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
          <div v-if="!userProfile.emailVerified" class="verification-blocker mb-4">
            <div class="verification-blocker-content">
              <i class="bi bi-shield-exclamation verification-blocker-icon"></i>
              <div class="verification-blocker-text">
                <p class="verification-blocker-message mb-0">
                  Please verify your email address to change your password.
                </p>
              </div>
            </div>
          </div>
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
                  :disabled="profileDataLoading || !userProfile.emailVerified"
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
                  :disabled="profileDataLoading || !userProfile.emailVerified"
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
                  :disabled="profileDataLoading || !userProfile.emailVerified"
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
              <button type="submit" class="btn btn-primary" :disabled="profileDataLoading || passwordLoading || !userProfile.emailVerified">
                <span v-if="passwordLoading" class="spinner-border spinner-border-sm me-2"></span>
                {{ passwordLoading ? 'Changing...' : 'Change Password' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    <!-- Confirm Dialog -->
    <ConfirmDialog
      :show="showConfirmDialog"
      :title="confirmDialogTitle"
      :message="confirmDialogMessage"
      :confirmText="confirmDialogConfirmText"
      :cancelText="confirmDialogCancelText"
      :confirmButtonClass="confirmDialogButtonClass"
      @confirm="handleConfirmDialogConfirm"
      @cancel="handleConfirmDialogCancel"
    />
  </div>
</template>

<script>
import axios from 'axios';
import { orthancApiUrl } from '../globalConfigurations';
import ConfirmDialog from './ConfirmDialog.vue';
import api from '../orthancApi';

export default {
  name: 'AccountSettings',
  components: {
    ConfirmDialog
  },
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
      subscriptionInfo: null,
      doctorSubscription: null,
      joinHospitalId: '',
      profileLoading: false,
      profileDataLoading: false, // Loading state for initial profile data fetch
      passwordLoading: false,
      resendLoading: false,
      joinLoading: false,
      leaveLoading: false,
      invitationLoading: false,
      isEditingProfile: false,
      originalProfile: {
        username: '',
        name: '',
        email: ''
      },
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
      usernameCheckTimeout: null,
      // Confirm dialog state
      showConfirmDialog: false,
      confirmDialogTitle: '',
      confirmDialogMessage: '',
      confirmDialogConfirmText: 'Confirm',
      confirmDialogCancelText: 'Cancel',
      confirmDialogButtonClass: 'btn-primary',
      confirmDialogAction: null
    };
  },
  computed: {
    hasProfileChanges() {
      if (!this.isEditingProfile) return false;
      return this.userProfile.username !== this.originalProfile.username ||
             this.userProfile.name !== this.originalProfile.name ||
             this.userProfile.email !== this.originalProfile.email;
    },
    canSaveProfile() {
      if (!this.isEditingProfile) return false;
      if (this.profileLoading) return false;
      // If username changed, it must be valid
      if (this.userProfile.username !== this.originalProfile.username) {
        return !this.usernameError && this.usernameValid;
      }
      // If username unchanged, allow save if name or email changed
      return this.hasProfileChanges;
    }
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
      this.profileDataLoading = true;
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
          this.originalProfile = {
            username: response.data.user.username,
            name: response.data.user.name,
            email: response.data.user.email
          };
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
          
          // Set subscription info for admin
          if (response.data.user.role === 'admin' && response.data.user.subscription) {
            this.subscriptionInfo = response.data.user.subscription;
          }
          
          // Set doctor subscription info
          if (response.data.user.role === 'doctor' && response.data.user.doctorSubscription) {
            this.doctorSubscription = response.data.user.doctorSubscription;
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('auth-token');
          this.$router.push('/login');
        }
      } finally {
        this.profileDataLoading = false;
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
    
    startEditingProfile() {
      if (!this.userProfile.emailVerified) {
        this.profileError = 'Please verify your email address to edit your profile.';
        return;
      }
      this.isEditingProfile = true;
      this.profileError = '';
      this.profileSuccess = '';
      // Reset username validation state when starting to edit
      this.usernameError = '';
      this.usernameValid = true;
    },
    
    cancelEditingProfile() {
      // Revert to original values
      this.userProfile.username = this.originalProfile.username;
      this.userProfile.name = this.originalProfile.name;
      this.userProfile.email = this.originalProfile.email;
      this.originalUsername = this.originalProfile.username;
      this.usernameError = '';
      this.usernameValid = true;
      this.isEditingProfile = false;
      this.profileError = '';
      this.profileSuccess = '';
    },
    
    async updateProfile() {
      if (!this.userProfile.emailVerified) {
        this.profileError = 'Please verify your email address to update your profile.';
        return;
      }
      
      // Validate username if changed
      if (this.userProfile.username !== this.originalProfile.username && !this.usernameValid) {
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
          this.originalProfile = {
            username: response.data.user.username,
            name: response.data.user.name,
            email: response.data.user.email
          };
          
          // Update localStorage
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...storedUser, ...response.data.user }));
          
          // Exit edit mode
          this.isEditingProfile = false;
          
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
      if (!this.userProfile.emailVerified) {
        this.hospitalError = 'Please verify your email address to join a hospital.';
        return;
      }
      
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
    
    leaveHospital() {
      this.showConfirmDialog = true;
      this.confirmDialogTitle = 'Leave Hospital';
      this.confirmDialogMessage = 'Are you sure you want to leave this hospital?';
      this.confirmDialogConfirmText = 'Leave';
      this.confirmDialogCancelText = 'Cancel';
      this.confirmDialogButtonClass = 'btn-warning';
      this.confirmDialogAction = 'leaveHospital';
    },
    
    async executeLeaveHospital() {
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
      if (!this.userProfile.emailVerified) {
        this.passwordError = 'Please verify your email address to change your password.';
        return;
      }
      
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
    
    acceptInvitation() {
      if (!this.userProfile.emailVerified) {
        this.hospitalError = 'Please verify your email address to respond to hospital invitations.';
        return;
      }
      this.showConfirmDialog = true;
      this.confirmDialogTitle = 'Accept Invitation';
      this.confirmDialogMessage = 'Are you sure you want to accept this invitation?';
      this.confirmDialogConfirmText = 'Accept';
      this.confirmDialogCancelText = 'Cancel';
      this.confirmDialogButtonClass = 'btn-success';
      this.confirmDialogAction = 'acceptInvitation';
    },
    
    async executeAcceptInvitation() {
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
    
    rejectInvitation() {
      if (!this.userProfile.emailVerified) {
        this.hospitalError = 'Please verify your email address to respond to hospital invitations.';
        return;
      }
      this.showConfirmDialog = true;
      this.confirmDialogTitle = 'Reject Invitation';
      this.confirmDialogMessage = 'Are you sure you want to reject this invitation? This action cannot be undone.';
      this.confirmDialogConfirmText = 'Reject';
      this.confirmDialogCancelText = 'Cancel';
      this.confirmDialogButtonClass = 'btn-danger';
      this.confirmDialogAction = 'rejectInvitation';
    },
    
    async executeRejectInvitation() {
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
    
    handleConfirmDialogConfirm() {
      this.showConfirmDialog = false;
      
      // Execute the appropriate action based on confirmDialogAction
      if (this.confirmDialogAction === 'acceptInvitation') {
        this.executeAcceptInvitation();
      } else if (this.confirmDialogAction === 'rejectInvitation') {
        this.executeRejectInvitation();
      } else if (this.confirmDialogAction === 'leaveHospital') {
        this.executeLeaveHospital();
      }
      
      // Reset dialog state
      this.confirmDialogAction = null;
    },
    
    handleConfirmDialogCancel() {
      this.showConfirmDialog = false;
      this.confirmDialogAction = null;
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
    
    getSubscriptionPlanName() {
      if (!this.subscriptionInfo) return '';
      const planNames = {
        monthly: 'Monthly Plan',
        yearly: 'Yearly Plan',
        forever: 'Forever Plan'
      };
      return planNames[this.subscriptionInfo.planType] || this.subscriptionInfo.planType;
    },
    getSubscriptionIcon() {
      if (!this.subscriptionInfo) return 'bi bi-calendar';
      const icons = {
        monthly: 'bi bi-calendar-month',
        yearly: 'bi bi-calendar-year',
        forever: 'bi bi-infinity'
      };
      return icons[this.subscriptionInfo.planType] || 'bi bi-calendar';
    },
    getSubscriptionBadgeClass() {
      if (!this.subscriptionInfo) return 'bg-secondary';
      if (this.subscriptionInfo.planType === 'forever') return 'bg-success';
      if (this.subscriptionInfo.isActive) return 'bg-primary';
      return 'bg-danger';
    },
    getDaysRemainingClass() {
      if (!this.subscriptionInfo || this.subscriptionInfo.daysUntilExpiration === null) return '';
      const days = Math.max(0, this.subscriptionInfo.daysUntilExpiration);
      if (days <= 0) return 'text-danger';
      if (days <= 3) return 'text-danger';
      if (days <= 7) return 'text-warning';
      return 'text-success';
    },
    getDoctorSubscriptionPlanName() {
      if (!this.doctorSubscription) return '';
      const planNames = {
        monthly: 'Monthly Plan',
        yearly: 'Yearly Plan',
        forever: 'Forever Plan'
      };
      return planNames[this.doctorSubscription.planType] || this.doctorSubscription.planType;
    },
    getDoctorSubscriptionIcon() {
      if (!this.doctorSubscription) return 'bi bi-calendar';
      const icons = {
        monthly: 'bi bi-calendar-month',
        yearly: 'bi bi-calendar-year',
        forever: 'bi bi-infinity'
      };
      return icons[this.doctorSubscription.planType] || 'bi bi-calendar';
    },
    getDoctorSubscriptionBadgeClass() {
      if (!this.doctorSubscription) return 'bg-secondary';
      if (this.doctorSubscription.planType === 'forever') return 'bg-success';
      if (this.doctorSubscription.isActive) return 'bg-primary';
      return 'bg-danger';
    },
    getDoctorDaysRemainingClass() {
      if (!this.doctorSubscription || this.doctorSubscription.daysUntilExpiration === null) return '';
      const days = Math.max(0, this.doctorSubscription.daysUntilExpiration);
      if (days <= 0) return 'text-danger';
      if (days <= 3) return 'text-danger';
      if (days <= 7) return 'text-warning';
      return 'text-success';
    },
    formatDate(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    },
    
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

.verification-loading {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
}

.verification-loading .spinner-border-sm {
  width: 1rem;
  height: 1rem;
  border-width: 0.15em;
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

/* Creative Upgrade Button Design */
.role-toggle-wrapper {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 14px;
}

.role-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  user-select: none;
}

.role-toggle input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.upgrade-button {
  position: relative;
  min-width: 120px;
  height: 40px;
  padding: 0 20px;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  border-radius: 20px;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
}

.upgrade-button-bg {
  position: absolute;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%);
  opacity: 0;
  transition: opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1;
}

.upgrade-button-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 2;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.upgrade-icon {
  font-size: 16px;
  color: #6b7280;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  align-items: center;
}

.upgrade-icon.active {
  color: #ffffff;
}

.upgrade-text {
  color: #6b7280;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  letter-spacing: 0.3px;
}

.upgrade-text.active {
  color: #ffffff;
}

.upgrade-button-shine {
  position: absolute;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, 
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  transform: translateX(-100%);
  transition: transform 0.6s ease;
  z-index: 3;
  pointer-events: none;
}

.upgrade-button:hover .upgrade-button-shine {
  transform: translateX(100%);
}

/* Checked State - Admin Active */
.role-toggle input[type="checkbox"]:checked ~ .upgrade-button {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 
    0 0 20px rgba(59, 130, 246, 0.4),
    0 4px 12px rgba(59, 130, 246, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.role-toggle input[type="checkbox"]:checked ~ .upgrade-button .upgrade-button-bg {
  opacity: 1;
}

/* Admin Active State - Subtle Breathing */
.role-toggle.admin-active input[type="checkbox"]:checked ~ .upgrade-button {
  animation: button-breathe 4s ease-in-out infinite;
}

/* Upgrading State - Smooth Flow */
.role-toggle.upgrading .upgrade-button {
  animation: button-flow 1.5s ease-in-out infinite;
  box-shadow: 
    0 0 25px rgba(59, 130, 246, 0.5),
    0 6px 16px rgba(59, 130, 246, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.role-toggle.upgrading .upgrade-button-content {
  animation: content-pulse 1.5s ease-in-out infinite;
}

/* Upgraded Success State - Fun & Fantastic Celebration */
.role-toggle.upgraded .upgrade-button {
  animation: button-celebration 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

.role-toggle.upgraded .upgrade-button::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 20px;
  background: linear-gradient(45deg, 
    rgba(16, 185, 129, 0.3) 0%,
    rgba(59, 130, 246, 0.3) 25%,
    rgba(168, 85, 247, 0.3) 50%,
    rgba(236, 72, 153, 0.3) 75%,
    rgba(251, 191, 36, 0.3) 100%
  );
  animation: rainbow-shimmer 1.5s ease-in-out;
  z-index: 0;
}

.role-toggle.upgraded .upgrade-button-content {
  animation: content-bounce 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.role-toggle.upgraded .upgrade-icon::after {
  content: '✨';
  position: absolute;
  font-size: 12px;
  animation: sparkle-pop 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
  margin-left: 4px;
}

/* Smooth Fade-Out Transition */
.role-toggle.fading-out .upgrade-button {
  animation: button-fade-out 1.5s ease-out forwards;
}

.role-toggle.fading-out .upgrade-button::before {
  animation: rainbow-fade-out 1.5s ease-out forwards;
}

.role-toggle.fading-out .upgrade-success {
  animation: success-fade-out 1.5s ease-out forwards;
}

.role-toggle input[type="checkbox"]:disabled ~ .upgrade-button {
  opacity: 0.6;
  cursor: not-allowed;
  filter: grayscale(0.3);
}

.role-toggle-label {
  font-size: 14px;
  font-weight: 500;
  user-select: none;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
}

.role-label-active {
  color: #3b82f6;
}

.role-label-inactive {
  color: #6b7280;
}

.role-toggle input[type="checkbox"]:checked ~ .role-toggle-label .role-label-active {
  animation: natural-glow 2.5s ease-in-out infinite;
}

/* Upgrade Status Indicators */
.upgrade-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  color: #4a90e2;
  font-size: 13px;
  font-weight: 500;
}

.upgrade-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
  font-size: 16px;
}

.upgrade-success {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  animation: success-fade-in 0.5s ease-out;
  position: relative;
}

.upgrade-success::before {
  content: '🎉';
  position: absolute;
  left: -20px;
  font-size: 14px;
  animation: confetti-burst 1.5s ease-out;
  pointer-events: none;
}

.upgrade-success::after {
  content: '✨';
  position: absolute;
  right: -20px;
  font-size: 14px;
  animation: confetti-burst 1.5s ease-out 0.2s;
  pointer-events: none;
}

.success-icon {
  color: #10b981;
  font-size: 18px;
  animation: success-scale 0.5s ease-out;
}

.success-text {
  color: #10b981;
  font-size: 13px;
  font-weight: 600;
}

/* Animations */
@keyframes button-breathe {
  0%, 100% {
    box-shadow: 
      0 0 20px rgba(59, 130, 246, 0.4),
      0 4px 12px rgba(59, 130, 246, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  50% {
    box-shadow: 
      0 0 28px rgba(59, 130, 246, 0.5),
      0 6px 16px rgba(59, 130, 246, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
}

@keyframes button-flow {
  0%, 100% {
    transform: scale(1);
    box-shadow: 
      0 0 25px rgba(59, 130, 246, 0.5),
      0 6px 16px rgba(59, 130, 246, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 
      0 0 35px rgba(59, 130, 246, 0.6),
      0 8px 20px rgba(59, 130, 246, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
}

@keyframes content-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes button-celebration {
  0% {
    transform: scale(1) rotate(0deg);
    box-shadow: 
      0 0 20px rgba(59, 130, 246, 0.4),
      0 4px 12px rgba(59, 130, 246, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  20% {
    transform: scale(1.1) rotate(2deg);
    box-shadow: 
      0 0 45px rgba(16, 185, 129, 0.7),
      0 8px 24px rgba(16, 185, 129, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  40% {
    transform: scale(1.06) rotate(-1deg);
    box-shadow: 
      0 0 40px rgba(168, 85, 247, 0.6),
      0 7px 22px rgba(168, 85, 247, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  60% {
    transform: scale(1.08) rotate(1deg);
    box-shadow: 
      0 0 42px rgba(236, 72, 153, 0.6),
      0 7px 23px rgba(236, 72, 153, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  80% {
    transform: scale(1.04) rotate(-0.5deg);
    box-shadow: 
      0 0 32px rgba(251, 191, 36, 0.5),
      0 6px 20px rgba(251, 191, 36, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  100% {
    transform: scale(1) rotate(0deg);
    box-shadow: 
      0 0 20px rgba(59, 130, 246, 0.4),
      0 4px 12px rgba(59, 130, 246, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
}

@keyframes content-bounce {
  0%, 100% {
    transform: scale(1) translateY(0);
  }
  15% {
    transform: scale(1.15) translateY(-2px);
  }
  30% {
    transform: scale(1.08) translateY(0);
  }
  45% {
    transform: scale(1.12) translateY(-1px);
  }
  60% {
    transform: scale(1.06) translateY(0);
  }
  75% {
    transform: scale(1.09) translateY(-0.5px);
  }
  90% {
    transform: scale(1.03) translateY(0);
  }
}

@keyframes button-fade-out {
  0% {
    transform: scale(1);
    box-shadow: 
      0 0 20px rgba(59, 130, 246, 0.4),
      0 4px 12px rgba(59, 130, 246, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  100% {
    transform: scale(1);
    box-shadow: 
      0 0 20px rgba(59, 130, 246, 0.4),
      0 4px 12px rgba(59, 130, 246, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
}

@keyframes rainbow-shimmer {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  30% {
    opacity: 0.8;
    transform: scale(1.1);
  }
  60% {
    opacity: 0.6;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.9);
  }
}

@keyframes sparkle-pop {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: translateY(-15px) scale(1.5) rotate(180deg);
  }
  60% {
    opacity: 0.8;
    transform: translateY(-25px) scale(1.2) rotate(360deg);
  }
  100% {
    opacity: 0;
    transform: translateY(-35px) scale(0.8) rotate(540deg);
  }
}

@keyframes rainbow-fade-out {
  0% {
    opacity: 0.3;
  }
  100% {
    opacity: 0;
  }
}

@keyframes success-fade-out {
  0% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-10px) scale(0.9);
  }
}

@keyframes success-fade-in {
  0% {
    opacity: 0;
    transform: translateX(-10px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes confetti-burst {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: translateY(-20px) scale(1.2) rotate(180deg);
  }
  100% {
    opacity: 0;
    transform: translateY(-40px) scale(0.8) rotate(360deg);
  }
}

@keyframes success-scale {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes natural-glow {
  0%, 100% {
    text-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
  }
  50% {
    text-shadow: 0 0 15px rgba(59, 130, 246, 0.6), 0 0 25px rgba(59, 130, 246, 0.4);
  }
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

/* Subscription styles */
.subscription-details {
  padding: 8px 0;
}

.subscription-badge {
  display: flex;
  align-items: center;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}

.expiration-details {
  margin-top: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  margin-bottom: 8px;
}

.detail-label {
  color: #6b7280;
  display: flex;
  align-items: center;
}

.detail-value {
  font-weight: 600;
  color: #111827;
}

.forever-plan-info {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  color: #166534;
  font-size: 14px;
  font-weight: 500;
}

.warning-alert {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  color: #92400e;
  font-size: 14px;
  line-height: 1.5;
}

.warning-alert i {
  flex-shrink: 0;
  margin-top: 2px;
}

.expired-alert {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
  font-size: 14px;
  line-height: 1.5;
}

.expired-alert i {
  flex-shrink: 0;
  margin-top: 2px;
}

.no-subscription-info {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #6b7280;
  font-size: 14px;
}

.hospital-subscription-info {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

/* Field Display Styles */
.field-display {
  flex: 1;
  display: flex;
  align-items: center;
}

.field-value {
  font-size: 15px;
  color: #1f2937;
  font-weight: 500;
  padding: 8px 0;
  line-height: 1.5;
}

/* Profile Actions */
.profile-actions {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Verification Blocker Styles */
.verification-blocker {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fbbf24;
  border-radius: 12px;
  padding: 16px;
  animation: slideDown 0.3s ease-out;
}

.verification-blocker-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.verification-blocker-icon {
  font-size: 24px;
  color: #d97706;
  flex-shrink: 0;
  margin-top: 2px;
}

.verification-blocker-text {
  flex: 1;
}

.verification-blocker-title {
  font-size: 15px;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 4px;
}

.verification-blocker-message {
  font-size: 14px;
  color: #78350f;
  line-height: 1.5;
  margin: 0;
}

/* Verification Notice (less intrusive) */
.verification-notice {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fbbf24;
  border-radius: 8px;
  padding: 12px 16px;
  animation: slideDown 0.3s ease-out;
}

.verification-notice-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.verification-notice-icon {
  font-size: 18px;
  color: #d97706;
  flex-shrink: 0;
}

.verification-notice-text {
  font-size: 14px;
  color: #78350f;
  font-weight: 500;
}

.role-toggle.disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.role-toggle.disabled .upgrade-button {
  filter: grayscale(0.5);
  opacity: 0.8;
}

/* Disabled Input Styles */
.form-control:disabled {
  background-color: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-primary:disabled {
  background-color: #d1d5db;
  border-color: #d1d5db;
  color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.7;
}

/* Animation */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .profile-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .profile-actions .btn {
    width: 100%;
  }
  
  .verification-blocker-content {
    flex-direction: column;
    text-align: center;
  }
  
  .verification-blocker-icon {
    align-self: center;
  }
}
</style>
