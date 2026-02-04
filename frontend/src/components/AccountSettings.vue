<template>
  <div class="as-page">
    <div class="as-container">
      <!-- Loading State -->
      <div v-if="profileDataLoading" class="as-loading">
        <div class="as-loading-spinner"></div>
        <p class="as-loading-text">Loading your profile...</p>
      </div>

      <template v-else>
        <!-- Profile Hero Card -->
        <section class="as-profile-hero">
          <div class="as-profile-bg"></div>
          <div class="as-profile-content">
            <div class="as-avatar">
              <span class="as-avatar-text">{{ getInitials(userProfile.name) }}</span>
            </div>
            <div class="as-profile-info">
              <h1 class="as-profile-name">{{ userProfile.name }}</h1>
              <p class="as-profile-username">@{{ userProfile.username }}</p>
              <div class="as-profile-badges">
                <span class="as-role-badge" :class="'as-role-' + userProfile.role">
                  <i :class="getRoleIcon(userProfile.role)"></i>
                  {{ formatRole(userProfile.role) }}
                </span>
                <span v-if="userProfile.emailVerified" class="as-status-badge as-status-verified">
                  <i class="bi bi-patch-check-fill"></i> Verified
                </span>
                <span v-else class="as-status-badge as-status-unverified">
                  <i class="bi bi-exclamation-triangle-fill"></i> Unverified
                </span>
              </div>
            </div>
            <button 
              v-if="!isEditingProfile"
              type="button" 
              class="as-edit-btn"
              @click="startEditingProfile"
              :disabled="!userProfile.emailVerified"
            >
              <i class="bi bi-pencil-square"></i>
            </button>
          </div>
        </section>

        <!-- Profile Details Card -->
        <section class="as-card">
          <div class="as-card-header">
            <h2 class="as-section-title">
              <i class="bi bi-person-vcard"></i>
              Profile Information
            </h2>
          </div>
          <div class="as-card-body">
            <form @submit.prevent="updateProfile">
              <!-- Info Grid (read-only mode) -->
              <div v-if="!isEditingProfile" class="as-info-grid">
                <div class="as-info-item">
                  <div class="as-info-icon"><i class="bi bi-at"></i></div>
                  <div class="as-info-content">
                    <span class="as-info-label">Username</span>
                    <span class="as-info-value">{{ userProfile.username }}</span>
                  </div>
                </div>
                <div class="as-info-item">
                  <div class="as-info-icon"><i class="bi bi-person"></i></div>
                  <div class="as-info-content">
                    <span class="as-info-label">Full Name</span>
                    <span class="as-info-value">{{ userProfile.name }}</span>
                  </div>
                </div>
                <div class="as-info-item as-info-full">
                  <div class="as-info-icon"><i class="bi bi-envelope"></i></div>
                  <div class="as-info-content">
                    <span class="as-info-label">Email Address</span>
                    <span class="as-info-value">{{ userProfile.email }}</span>
                  </div>
                  <span v-if="userProfile.emailVerified" class="as-inline-badge as-badge-success">
                    <i class="bi bi-check-circle-fill"></i> Verified
                  </span>
                  <span v-else class="as-inline-badge as-badge-warning">
                    <i class="bi bi-exclamation-circle"></i> Unverified
                  </span>
                </div>
              </div>

              <!-- Edit Mode -->
              <div v-else class="as-edit-form">
                <div class="as-form-row">
                  <div class="as-form-group">
                    <label class="as-form-label">Username</label>
                    <div class="as-input-wrap">
                      <span class="as-input-prefix">@</span>
                      <input 
                        type="text" 
                        class="as-form-input as-input-prefixed"
                        :class="{ 'as-input-valid': usernameValid && userProfile.username !== originalUsername, 'as-input-invalid': usernameError }"
                        v-model="userProfile.username"
                        required
                        placeholder="username"
                        @input="checkUsernameAvailability"
                      />
                      <span v-if="checkingUsername" class="as-input-status as-status-checking">
                        <i class="bi bi-arrow-repeat as-spin"></i>
                      </span>
                      <span v-else-if="usernameValid && userProfile.username !== originalUsername" class="as-input-status as-status-valid">
                        <i class="bi bi-check-circle-fill"></i>
                      </span>
                      <span v-else-if="usernameError" class="as-input-status as-status-invalid">
                        <i class="bi bi-x-circle-fill"></i>
                      </span>
                    </div>
                    <p v-if="usernameError" class="as-form-error">{{ usernameError }}</p>
                  </div>
                  <div class="as-form-group">
                    <label class="as-form-label">Full Name</label>
                    <input 
                      type="text" 
                      class="as-form-input"
                      v-model="userProfile.name"
                      required
                      placeholder="Enter your name"
                    />
                  </div>
                </div>
                <div class="as-form-group">
                  <label class="as-form-label">Email Address</label>
                  <input 
                    type="email" 
                    class="as-form-input"
                    v-model="userProfile.email"
                    required
                    placeholder="Enter your email"
                  />
                </div>
                <div class="as-edit-actions">
                  <button type="submit" class="as-btn as-btn-primary" :disabled="!canSaveProfile">
                    <span v-if="profileLoading" class="as-spinner-sm"></span>
                    <i v-else class="bi bi-check-lg"></i>
                    {{ profileLoading ? 'Saving...' : 'Save Changes' }}
                  </button>
                  <button type="button" class="as-btn as-btn-ghost" @click="cancelEditingProfile" :disabled="profileLoading">
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Email Verification Warning -->
              <div v-if="!userProfile.emailVerified && !isEditingProfile" class="as-verify-banner">
                <div class="as-verify-icon"><i class="bi bi-shield-exclamation"></i></div>
                <div class="as-verify-content">
                  <p class="as-verify-title">Email verification required</p>
                  <p class="as-verify-desc">Verify your email to edit profile, join hospitals, or change password.</p>
                </div>
                <button type="button" class="as-btn as-btn-warning" @click="resendVerification" :disabled="resendLoading">
                  <span v-if="resendLoading" class="as-spinner-sm"></span>
                  {{ resendLoading ? 'Sending...' : 'Resend Email' }}
                </button>
              </div>

              <!-- Alerts -->
              <div v-if="profileSuccess" class="as-alert as-alert-success">
                <i class="bi bi-check-circle-fill"></i>
                <span>{{ profileSuccess }}</span>
                <button type="button" class="as-alert-close" @click="profileSuccess = ''">&times;</button>
              </div>
              <div v-if="profileError" class="as-alert as-alert-error">
                <i class="bi bi-exclamation-circle-fill"></i>
                <span>{{ profileError }}</span>
                <button type="button" class="as-alert-close" @click="profileError = ''">&times;</button>
              </div>
            </form>
          </div>
        </section>

        <!-- Subscription Status Section (for admins only) -->
        <section v-if="userProfile.role === 'admin'" class="as-card">
          <div class="as-card-header">
            <h2 class="as-section-title">
              <i class="bi bi-credit-card-2-front"></i>
              Subscription Status
            </h2>
            <span v-if="subscriptionInfo" class="as-plan-badge" :class="getSubscriptionBadgeClass()">
              <i :class="getSubscriptionIcon()"></i>
              {{ getSubscriptionPlanName() }}
            </span>
          </div>
          <div class="as-card-body">
            <div v-if="subscriptionInfo" class="as-sub-content">
              <div v-if="subscriptionInfo.planType === 'forever'" class="as-sub-forever">
                <div class="as-forever-icon"><i class="bi bi-infinity"></i></div>
                <div class="as-forever-text">
                  <p class="as-forever-title">Unlimited Access</p>
                  <p class="as-forever-desc">Your subscription never expires</p>
                </div>
              </div>
              <template v-else>
                <div class="as-sub-grid">
                  <div class="as-sub-stat">
                    <div class="as-stat-icon"><i class="bi bi-calendar-event"></i></div>
                    <div class="as-stat-content">
                      <span class="as-stat-label">Expires On</span>
                      <span class="as-stat-value">{{ formatDate(subscriptionInfo.expiresAt) }}</span>
                    </div>
                  </div>
                  <div class="as-sub-stat">
                    <div class="as-stat-icon" :class="getDaysRemainingClass()"><i class="bi bi-hourglass-split"></i></div>
                    <div class="as-stat-content">
                      <span class="as-stat-label">Days Remaining</span>
                      <span class="as-stat-value" :class="getDaysRemainingClass()">
                        {{ subscriptionInfo.daysUntilExpiration !== null ? Math.max(0, subscriptionInfo.daysUntilExpiration) : 'N/A' }}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-if="subscriptionInfo.shouldShowWarning" class="as-alert as-alert-warning">
                  <i class="bi bi-exclamation-triangle-fill"></i>
                  <span>{{ Math.max(0, subscriptionInfo.daysUntilExpiration) }} days remaining. Contact the owner to extend.</span>
                </div>
                <div v-if="!subscriptionInfo.isActive" class="as-alert as-alert-error">
                  <i class="bi bi-x-circle-fill"></i>
                  <span>Subscription expired. Contact the owner to renew.</span>
                </div>
              </template>
            </div>
            <div v-else class="as-empty-state">
              <i class="bi bi-credit-card-2-front"></i>
              <p>No subscription found. Contact the owner.</p>
            </div>
          </div>
        </section>

        <!-- Hospital Membership Section (for doctors only) -->
        <section v-if="userProfile.role === 'doctor'" class="as-card">
          <div class="as-card-header">
            <h2 class="as-section-title">
              <i class="bi bi-building"></i>
              Hospital Membership
            </h2>
            <span v-if="hospitalMembership" class="as-membership-badge" :class="'as-mbadge-' + hospitalMembership.status">
              {{ formatMembershipStatus(hospitalMembership.status) }}
            </span>
          </div>
          <div class="as-card-body">
            <!-- Pending Invitation -->
            <div v-if="hospitalMembership && hospitalMembership.status === 'pending_invitation'" class="as-invite-card">
              <div class="as-invite-header">
                <div class="as-invite-icon"><i class="bi bi-envelope-paper-heart"></i></div>
                <div class="as-invite-info">
                  <h3 class="as-invite-title">You've been invited!</h3>
                  <p class="as-invite-hospital">{{ hospitalMembership.hospital.name }}</p>
                </div>
              </div>
              <div class="as-invite-details">
                <div class="as-invite-detail"><i class="bi bi-hash"></i> {{ hospitalMembership.hospital.hospitalId }}</div>
                <div v-if="hospitalMembership.hospital.address" class="as-invite-detail"><i class="bi bi-geo-alt"></i> {{ hospitalMembership.hospital.address }}</div>
                <div v-if="hospitalMembership.invitedBy" class="as-invite-detail"><i class="bi bi-person"></i> By {{ hospitalMembership.invitedBy.name || hospitalMembership.invitedBy.username }}</div>
              </div>
              <div class="as-invite-actions">
                <button class="as-btn as-btn-success" @click="acceptInvitation" :disabled="invitationLoading || !userProfile.emailVerified">
                  <span v-if="invitationLoading" class="as-spinner-sm"></span>
                  <i v-else class="bi bi-check-lg"></i> Accept
                </button>
                <button class="as-btn as-btn-danger-outline" @click="rejectInvitation" :disabled="invitationLoading || !userProfile.emailVerified">
                  <i class="bi bi-x-lg"></i> Decline
                </button>
              </div>
            </div>

            <!-- Current Membership -->
            <div v-else-if="hospitalMembership && hospitalMembership.status !== 'pending_invitation'" class="as-hospital-card" :class="'as-hcard-' + hospitalMembership.status">
              <div class="as-hospital-header">
                <div class="as-hospital-icon"><i class="bi bi-hospital"></i></div>
                <div class="as-hospital-info">
                  <h3 class="as-hospital-name">{{ hospitalMembership.hospital.name }}</h3>
                  <span class="as-hospital-id">{{ hospitalMembership.hospital.hospitalId }}</span>
                </div>
              </div>
              <div class="as-hospital-meta">
                <div v-if="hospitalMembership.hospital.address" class="as-hospital-detail">
                  <i class="bi bi-geo-alt-fill"></i> {{ hospitalMembership.hospital.address }}
                </div>
                <div v-if="hospitalMembership.joinedAt" class="as-hospital-detail">
                  <i class="bi bi-calendar-check-fill"></i> Joined {{ formatDate(hospitalMembership.joinedAt) }}
                </div>
              </div>
              
              <!-- Hospital Subscription (for accepted members) -->
              <div v-if="hospitalMembership.status === 'accepted' && doctorSubscription" class="as-hsub-section">
                <div class="as-hsub-header">
                  <span class="as-hsub-label">Hospital Subscription</span>
                  <span class="as-plan-badge" :class="getDoctorSubscriptionBadgeClass()">
                    <i :class="getDoctorSubscriptionIcon()"></i> {{ getDoctorSubscriptionPlanName() }}
                  </span>
                </div>
                <div v-if="doctorSubscription.planType === 'forever'" class="as-hsub-forever">
                  <i class="bi bi-infinity"></i> Unlimited access
                </div>
                <template v-else>
                  <div class="as-hsub-info">
                    <span><i class="bi bi-calendar"></i> Expires: {{ formatDate(doctorSubscription.expiresAt) }}</span>
                    <span :class="getDoctorDaysRemainingClass()"><i class="bi bi-hourglass"></i> {{ doctorSubscription.daysUntilExpiration !== null ? Math.max(0, doctorSubscription.daysUntilExpiration) : 'N/A' }} days</span>
                  </div>
                  <div v-if="doctorSubscription.shouldShowWarning" class="as-alert as-alert-warning as-alert-sm">
                    <i class="bi bi-exclamation-triangle"></i> Contact admin to extend.
                  </div>
                  <div v-if="!doctorSubscription.isActive" class="as-alert as-alert-error as-alert-sm">
                    <i class="bi bi-x-circle"></i> Hospital suspended.
                  </div>
                </template>
              </div>
              <div v-if="hospitalMembership.status === 'pending' || hospitalMembership.status === 'accepted'" class="as-hospital-actions">
                <button class="as-btn as-btn-danger-outline" @click="leaveHospital" :disabled="leaveLoading">
                  <span v-if="leaveLoading" class="as-spinner-sm"></span>
                  <i v-else class="bi bi-box-arrow-right"></i>
                  {{ hospitalMembership.status === 'pending' ? 'Cancel Request' : 'Leave Hospital' }}
                </button>
              </div>
            </div>

            <!-- Join Hospital Form -->
            <div v-if="!hospitalMembership || hospitalMembership.status === 'kicked'" class="as-join-section">
              <div class="as-join-header">
                <i class="bi bi-hospital"></i>
                <div>
                  <h3 class="as-join-title">Join a Hospital</h3>
                  <p class="as-join-desc">Enter a hospital ID to request membership</p>
                </div>
              </div>
              <div v-if="!userProfile.emailVerified" class="as-verify-banner as-verify-compact">
                <i class="bi bi-shield-exclamation"></i>
                <span>Verify your email to join a hospital.</span>
              </div>
              <form @submit.prevent="joinHospital" class="as-join-form">
                <input type="text" class="as-form-input" v-model="joinHospitalId" placeholder="HSP-XXXXXX" :disabled="!userProfile.emailVerified" />
                <button type="submit" class="as-btn as-btn-primary" :disabled="joinLoading || !joinHospitalId || !userProfile.emailVerified">
                  <span v-if="joinLoading" class="as-spinner-sm"></span>
                  <i v-else class="bi bi-send"></i> Request
                </button>
              </form>
              <div v-if="hospitalSuccess" class="as-alert as-alert-success"><i class="bi bi-check-circle-fill"></i> {{ hospitalSuccess }} <button type="button" class="as-alert-close" @click="hospitalSuccess = ''">&times;</button></div>
              <div v-if="hospitalError" class="as-alert as-alert-error"><i class="bi bi-exclamation-circle-fill"></i> {{ hospitalError }} <button type="button" class="as-alert-close" @click="hospitalError = ''">&times;</button></div>
            </div>
          </div>
        </section>

        <!-- Change Password Section -->
        <section class="as-card">
          <div class="as-card-header">
            <h2 class="as-section-title">
              <i class="bi bi-shield-lock"></i>
              Security Settings
            </h2>
          </div>
          <div class="as-card-body">
            <div v-if="!userProfile.emailVerified" class="as-verify-banner as-verify-compact">
              <i class="bi bi-shield-exclamation"></i>
              <span>Verify your email to change your password.</span>
            </div>
            <form @submit.prevent="changePassword" class="as-password-form">
              <div class="as-form-group">
                <label class="as-form-label">Current Password</label>
                <div class="as-password-wrap">
                  <input :type="showCurrentPassword ? 'text' : 'password'" class="as-form-input" v-model="passwordForm.currentPassword" required placeholder="Enter current password" :disabled="!userProfile.emailVerified" />
                  <button type="button" class="as-password-toggle" @click="showCurrentPassword = !showCurrentPassword">
                    <i :class="showCurrentPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                  </button>
                </div>
              </div>
              <div class="as-form-row">
                <div class="as-form-group">
                  <label class="as-form-label">New Password</label>
                  <div class="as-password-wrap">
                    <input :type="showNewPassword ? 'text' : 'password'" class="as-form-input" v-model="passwordForm.newPassword" required minlength="6" placeholder="Min. 6 characters" :disabled="!userProfile.emailVerified" />
                    <button type="button" class="as-password-toggle" @click="showNewPassword = !showNewPassword">
                      <i :class="showNewPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                    </button>
                  </div>
                </div>
                <div class="as-form-group">
                  <label class="as-form-label">Confirm Password</label>
                  <div class="as-password-wrap">
                    <input :type="showConfirmPassword ? 'text' : 'password'" class="as-form-input" v-model="passwordForm.confirmPassword" required placeholder="Confirm password" :disabled="!userProfile.emailVerified" />
                    <button type="button" class="as-password-toggle" @click="showConfirmPassword = !showConfirmPassword">
                      <i :class="showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="passwordSuccess" class="as-alert as-alert-success">
                <i class="bi bi-check-circle-fill"></i>
                <span>{{ passwordSuccess }}</span>
                <button type="button" class="as-alert-close" @click="passwordSuccess = ''">&times;</button>
              </div>
              <div v-if="passwordError" class="as-alert as-alert-error">
                <i class="bi bi-exclamation-circle-fill"></i>
                <span>{{ passwordError }}</span>
                <button type="button" class="as-alert-close" @click="passwordError = ''">&times;</button>
              </div>
              
              <div class="as-pwd-actions">
                <button type="submit" class="as-btn as-btn-primary" :disabled="passwordLoading || !userProfile.emailVerified">
                  <span v-if="passwordLoading" class="as-spinner-sm"></span>
                  <i v-else class="bi bi-shield-check"></i>
                  {{ passwordLoading ? 'Updating...' : 'Update Password' }}
                </button>
              </div>
            </form>
          </div>
        </section>
      </template>
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
    
    getInitials(name) {
      if (!name) return '?';
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
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
/* ==========================================
   ACCOUNT SETTINGS - MODERN HEAVY DESIGN
   ========================================== */

.as-page {
  width: 100%;
  min-height: calc(100vh - 60px);
  padding: 32px 20px;
  background: linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.as-container {
  max-width: 720px;
  margin: 0 auto;
}

/* ==========================================
   PROFILE HERO SECTION
   ========================================== */

.as-profile-hero {
  position: relative;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
  margin-bottom: 24px;
}

.as-profile-bg {
  height: 100px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
}

.as-profile-content {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  padding: 0 28px 28px;
  margin-top: -50px;
  position: relative;
}

.as-avatar {
  width: 100px;
  height: 100px;
  border-radius: 20px;
  background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
  border: 4px solid #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.as-avatar-text {
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
}

.as-profile-info {
  flex: 1;
  padding-top: 54px;
}

.as-profile-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 2px 0;
  letter-spacing: -0.02em;
}

.as-profile-username {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 12px 0;
}

.as-profile-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.as-role-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.as-role-doctor {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1d4ed8;
}

.as-role-admin {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #b45309;
}

.as-role-owner {
  background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
  color: #7c3aed;
}

.as-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.as-status-verified {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #047857;
}

.as-status-unverified {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #b45309;
}

.as-edit-btn {
  position: absolute;
  top: -36px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #64748b;
  transition: all 0.2s ease;
}

.as-edit-btn:hover:not(:disabled) {
  background: #fff;
  color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.25);
}

.as-edit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==========================================
   LOADING STATE
   ========================================== */

.as-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 24px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.as-loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: as-spin 0.8s linear infinite;
}

.as-loading-text {
  margin: 20px 0 0 0;
  font-size: 15px;
  color: #64748b;
  font-weight: 500;
}

@keyframes as-spin {
  to { transform: rotate(360deg); }
}

.as-spinner-sm {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: as-spin 0.7s linear infinite;
  opacity: 0.7;
}

/* ==========================================
   CARDS
   ========================================== */

.as-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04);
  margin-bottom: 20px;
}

.as-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  background: #fafbfc;
}

.as-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.as-section-title i {
  font-size: 18px;
  color: #64748b;
}

.as-card-body {
  padding: 24px;
}

/* ==========================================
   INFO GRID (Profile Display)
   ========================================== */

.as-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.as-info-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.as-info-item.as-info-full {
  grid-column: 1 / -1;
}

.as-info-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.as-info-icon i {
  font-size: 18px;
  color: #fff;
}

.as-info-content {
  flex: 1;
  min-width: 0;
}

.as-info-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.as-info-value {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.as-inline-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  margin-left: auto;
  flex-shrink: 0;
}

.as-badge-success {
  background: #dcfce7;
  color: #15803d;
}

.as-badge-warning {
  background: #fef3c7;
  color: #b45309;
}

/* ==========================================
   EDIT FORM
   ========================================== */

.as-edit-form {
  padding: 4px 0;
}

.as-form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.as-form-group {
  margin-bottom: 20px;
}

.as-form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 8px;
}

.as-form-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  font-size: 15px;
  font-weight: 500;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  color: #1e293b;
  transition: all 0.2s ease;
  font-family: inherit;
}

.as-form-input:focus {
  outline: none;
  border-color: #667eea;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.as-form-input::placeholder {
  color: #94a3b8;
}

.as-form-input:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

.as-input-wrap {
  position: relative;
}

.as-input-prefix {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 15px;
  font-weight: 600;
  color: #94a3b8;
}

.as-input-prefixed {
  padding-left: 32px;
}

.as-input-status {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
}

.as-status-checking { color: #94a3b8; }
.as-status-valid { color: #10b981; }
.as-status-invalid { color: #ef4444; }

.as-spin { animation: as-spin 0.8s linear infinite; }

.as-form-input.as-input-valid { border-color: #10b981; }
.as-form-input.as-input-invalid { border-color: #ef4444; }

.as-form-error {
  margin-top: 6px;
  font-size: 13px;
  color: #ef4444;
}

.as-edit-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

/* ==========================================
   BUTTONS
   ========================================== */

.as-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.as-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.as-btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.35);
}

.as-btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.45);
}

.as-btn-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}

.as-btn-success:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
}

.as-btn-ghost {
  background: #fff;
  color: #64748b;
  border: 2px solid #e2e8f0;
}

.as-btn-ghost:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #475569;
}

.as-btn-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
}

.as-btn-warning:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
}

.as-btn-danger-outline {
  background: #fff;
  color: #ef4444;
  border: 2px solid #fecaca;
}

.as-btn-danger-outline:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #f87171;
}

/* ==========================================
   VERIFICATION BANNER
   ========================================== */

.as-verify-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fbbf24;
  border-radius: 12px;
  margin-top: 20px;
}

.as-verify-banner.as-verify-compact {
  padding: 12px 16px;
  gap: 12px;
  margin-top: 0;
  margin-bottom: 16px;
}

.as-verify-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(217, 119, 6, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.as-verify-icon i {
  font-size: 22px;
  color: #b45309;
}

.as-verify-content {
  flex: 1;
}

.as-verify-title {
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
  margin: 0 0 2px 0;
}

.as-verify-desc {
  font-size: 13px;
  color: #78350f;
  margin: 0;
}

/* ==========================================
   ALERTS
   ========================================== */

.as-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 12px;
  font-size: 14px;
  margin-top: 16px;
}

.as-alert i { font-size: 18px; flex-shrink: 0; }

.as-alert-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  opacity: 0.5;
  margin-left: auto;
  padding: 0;
}

.as-alert-close:hover { opacity: 1; }

.as-alert-success {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #166534;
}

.as-alert-error {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
}

.as-alert-warning {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
}

.as-alert-sm {
  padding: 10px 14px;
  font-size: 13px;
  border-radius: 10px;
}

/* ==========================================
   PLAN BADGES
   ========================================== */

.as-plan-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.as-plan-badge.bg-success {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #166534;
}

.as-plan-badge.bg-primary {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
}

.as-plan-badge.bg-danger {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
}

/* ==========================================
   SUBSCRIPTION SECTION
   ========================================== */

.as-sub-content {
  padding: 4px 0;
}

.as-sub-forever {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border-radius: 14px;
}

.as-forever-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.as-forever-icon i {
  font-size: 28px;
  color: #fff;
}

.as-forever-title {
  font-size: 16px;
  font-weight: 700;
  color: #065f46;
  margin: 0 0 2px 0;
}

.as-forever-desc {
  font-size: 14px;
  color: #047857;
  margin: 0;
}

.as-sub-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.as-sub-stat {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.as-stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.as-stat-icon i {
  font-size: 20px;
  color: #fff;
}

.as-stat-icon.text-danger { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
.as-stat-icon.text-warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
.as-stat-icon.text-success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }

.as-stat-label {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 2px;
}

.as-stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.as-stat-value.text-danger { color: #dc2626; }
.as-stat-value.text-warning { color: #d97706; }
.as-stat-value.text-success { color: #059669; }

/* ==========================================
   MEMBERSHIP BADGES
   ========================================== */

.as-membership-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.as-mbadge-accepted { background: #dcfce7; color: #166534; }
.as-mbadge-pending { background: #fef3c7; color: #b45309; }
.as-mbadge-pending_invitation { background: #dbeafe; color: #1e40af; }
.as-mbadge-blocked { background: #fee2e2; color: #dc2626; }
.as-mbadge-kicked { background: #f1f5f9; color: #64748b; }

/* ==========================================
   INVITATION CARD
   ========================================== */

.as-invite-card {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #bfdbfe;
}

.as-invite-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.as-invite-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.as-invite-icon i {
  font-size: 26px;
  color: #fff;
}

.as-invite-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e40af;
  margin: 0 0 2px 0;
}

.as-invite-hospital {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.as-invite-details {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
}

.as-invite-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}

.as-invite-detail i {
  color: #3b82f6;
}

.as-invite-actions {
  display: flex;
  gap: 12px;
}

/* ==========================================
   HOSPITAL CARD
   ========================================== */

.as-hospital-card {
  background: #f8fafc;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #e2e8f0;
}

.as-hcard-accepted { border-left-color: #10b981; }
.as-hcard-pending { border-left-color: #f59e0b; }
.as-hcard-blocked { border-left-color: #ef4444; }
.as-hcard-kicked { border-left-color: #94a3b8; }

.as-hospital-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.as-hospital-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.as-hospital-icon i {
  font-size: 24px;
  color: #fff;
}

.as-hospital-name {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.as-hospital-id {
  font-size: 12px;
  font-family: "SF Mono", Monaco, monospace;
  color: #64748b;
  background: #e2e8f0;
  padding: 3px 10px;
  border-radius: 6px;
}

.as-hospital-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
}

.as-hospital-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #475569;
}

.as-hospital-detail i {
  color: #8b5cf6;
}

.as-hospital-actions {
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

/* Hospital Subscription Sub-section */
.as-hsub-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.as-hsub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.as-hsub-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
}

.as-hsub-forever {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #dcfce7;
  border-radius: 8px;
  color: #166534;
  font-size: 14px;
  font-weight: 600;
}

.as-hsub-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #475569;
  padding: 8px 0;
}

.as-hsub-info i {
  margin-right: 4px;
}

/* ==========================================
   JOIN HOSPITAL SECTION
   ========================================== */

.as-join-section {
  padding: 4px 0;
}

.as-join-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.as-join-header i {
  font-size: 28px;
  color: #8b5cf6;
}

.as-join-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 2px 0;
}

.as-join-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.as-join-form {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.as-join-form .as-form-input {
  flex: 1;
  max-width: 200px;
  font-family: "SF Mono", Monaco, monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* ==========================================
   PASSWORD SECTION
   ========================================== */

.as-password-form {
  padding: 4px 0;
}

.as-password-wrap {
  position: relative;
}

.as-password-wrap .as-form-input {
  padding-right: 48px;
}

.as-password-toggle {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  font-size: 18px;
  transition: color 0.2s ease;
}

.as-password-toggle:hover {
  color: #667eea;
}

.as-pwd-actions {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

/* ==========================================
   EMPTY STATE
   ========================================== */

.as-empty-state {
  text-align: center;
  padding: 40px 24px;
  background: #f8fafc;
  border-radius: 14px;
  border: 2px dashed #e2e8f0;
}

.as-empty-state i {
  font-size: 48px;
  color: #cbd5e1;
  display: block;
  margin-bottom: 16px;
}

.as-empty-state p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

/* ==========================================
   TEXT UTILITY CLASSES
   ========================================== */

.text-danger { color: #dc2626 !important; }
.text-warning { color: #d97706 !important; }
.text-success { color: #059669 !important; }

/* ==========================================
   RESPONSIVE
   ========================================== */

@media (max-width: 640px) {
  .as-page {
    padding: 16px 12px;
  }
  
  .as-profile-content {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 0 20px 24px;
  }
  
  .as-avatar {
    margin-top: -60px;
  }
  
  .as-profile-info {
    padding-top: 16px;
  }
  
  .as-profile-badges {
    justify-content: center;
  }
  
  .as-edit-btn {
    position: static;
    margin-top: 16px;
  }
  
  .as-info-grid {
    grid-template-columns: 1fr;
  }
  
  .as-form-row {
    grid-template-columns: 1fr;
  }
  
  .as-sub-grid {
    grid-template-columns: 1fr;
  }
  
  .as-edit-actions,
  .as-invite-actions,
  .as-join-form {
    flex-direction: column;
  }
  
  .as-join-form .as-form-input {
    max-width: none;
  }
  
  .as-invite-card,
  .as-hospital-card {
    padding: 20px;
  }
}
</style>
