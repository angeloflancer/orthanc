<template>
  <div class="user-management">
    <div class="container-fluid py-4">
      <div class="header-section">
        <h2 class="mb-0">User Management</h2>
        <div class="stats-badges">
          <span class="stat-badge">
            <i class="bi bi-people me-1"></i>{{ stats.totalUsers || 0 }} Total
          </span>
          <span class="stat-badge doctors">
            <i class="bi bi-person-badge me-1"></i>{{ stats.doctorCount || 0 }} Doctors
          </span>
          <span class="stat-badge admins">
            <i class="bi bi-building me-1"></i>{{ stats.adminCount || 0 }} Admins
          </span>
          <span v-if="stats.blockedCount > 0" class="stat-badge blocked">
            <i class="bi bi-slash-circle me-1"></i>{{ stats.blockedCount }} Blocked
          </span>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-section mb-4">
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input 
            type="text" 
            class="form-control" 
            placeholder="Search by username, name, or email..."
            v-model="searchQuery"
            @input="debouncedSearch"
            @focus="handleSearchFocus"
            autocomplete="nope"
            name="user-search"
            id="user-search-input"
            :readonly="searchInputReadonly"
          />
        </div>
        <div class="filter-row">
          <div class="filter-buttons">
            <button 
              v-for="role in roles" 
              :key="role.value"
              class="btn btn-filter"
              :class="{ active: filterRole === role.value }"
              @click="filterRole = role.value; loadUsers()"
            >
              <i :class="role.icon" class="me-1"></i>{{ role.label }}
            </button>
          </div>
          <div class="filter-buttons">
            <button 
              class="btn btn-filter"
              :class="{ active: filterBlocked === '' }"
              @click="filterBlocked = ''; loadUsers()"
            >
              All Status
            </button>
            <button 
              class="btn btn-filter"
              :class="{ active: filterBlocked === 'false' }"
              @click="filterBlocked = 'false'; loadUsers()"
            >
              Active
            </button>
            <button 
              class="btn btn-filter"
              :class="{ active: filterBlocked === 'true' }"
              @click="filterBlocked = 'true'; loadUsers()"
            >
              <i class="bi bi-slash-circle me-1"></i>Blocked
            </button>
          </div>
        </div>
      </div>

      <!-- Users Table -->
      <div class="card shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th style="text-align: left;">Username</th>
                <th style="text-align: left;">Name</th>
                <th style="text-align: left;">Email</th>
                <th style="text-align: left;">Role</th>
                <th style="text-align: left;">Status</th>
                <th style="text-align: left;">Joined</th>
                <th style="text-align: left;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="text-center py-4">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                </td>
              </tr>
              <tr v-else-if="users.length === 0">
                <td colspan="7" class="text-center py-4 text-muted">
                  <i class="bi bi-people display-4 d-block mb-2"></i>
                  No users found
                </td>
              </tr>
              <template v-for="user in users" :key="user.id">
                <tr 
                  :class="{ 'blocked-row': user.blocked, 'data-row-expanded': isExpanded(user.id) }"
                  @click="toggleExpand(user.id)"
                  style="cursor: pointer;"
                >
                  <td>
                    <span class="username">@{{ user.username }}</span>
                  </td>
                  <td>{{ user.name }}</td>
                  <td>{{ user.email }}</td>
                  <td>
                    <span v-if="user.role === 'owner'" class="role-badge owner">
                      <i class="bi bi-shield-check me-1"></i>Owner
                    </span>
                    <span v-else-if="user.role === 'admin'" class="role-badge admin">
                      <i class="bi bi-building me-1"></i>Admin
                    </span>
                    <span v-else class="role-badge doctor">
                      <i class="bi bi-person-badge me-1"></i>Doctor
                    </span>
                  </td>
                  <td>
                    <span v-if="user.blocked" class="status-badge blocked">
                      <i class="bi bi-slash-circle me-1"></i>Blocked
                    </span>
                    <span v-else class="status-badge active">
                      <i class="bi bi-check-circle me-1"></i>Active
                    </span>
                  </td>
                  <td>{{ formatDate(user.createdAt) }}</td>
                  <td @click.stop>
                    <div class="action-buttons" v-if="user.role !== 'owner'">
                      <button 
                        v-if="!user.blocked"
                        class="btn btn-sm btn-danger"
                        @click.stop="blockUser(user)"
                        title="Block User"
                      >
                        <i class="bi bi-slash-circle"></i>
                      </button>
                      <button 
                        v-else
                        class="btn btn-sm btn-success"
                        @click.stop="unblockUser(user)"
                        title="Unblock User"
                      >
                        <i class="bi bi-unlock"></i>
                      </button>
                    </div>
                    <span v-else class="text-muted">-</span>
                  </td>
                </tr>
                <!-- Expanded row with role editing -->
                <tr v-if="isExpanded(user.id)" class="details-row" @click.stop>
                  <td colspan="7">
                    <div class="details-content">
                      <div class="details-grid">
                        <!-- User Info Section -->
                        <div class="info-section">
                          <h6><i class="bi bi-person-fill me-2"></i>User Information</h6>
                          <div class="info-row">
                            <span class="info-label">Username:</span>
                            <span v-if="!isEditing(user.id)" class="info-value">@{{ user.username }}</span>
                            <input 
                              v-else
                              type="text" 
                              class="form-control form-control-sm edit-input"
                              v-model="editForms[user.id].username"
                              pattern="[a-zA-Z0-9_]+"
                              minlength="3"
                              maxlength="20"
                            />
                          </div>
                          <div class="info-row">
                            <span class="info-label">Full Name:</span>
                            <span v-if="!isEditing(user.id)" class="info-value">{{ user.name }}</span>
                            <input 
                              v-else
                              type="text" 
                              class="form-control form-control-sm edit-input"
                              v-model="editForms[user.id].name"
                              required
                            />
                          </div>
                          <div class="info-row">
                            <span class="info-label">Email:</span>
                            <span v-if="!isEditing(user.id)" class="info-value">{{ user.email }}</span>
                            <input 
                              v-else
                              type="email" 
                              class="form-control form-control-sm edit-input"
                              v-model="editForms[user.id].email"
                              autocomplete="email"
                              :name="`user-email-${user.id}`"
                              :id="`user-email-input-${user.id}`"
                              required
                            />
                          </div>
                          <div class="info-row">
                            <span class="info-label">Password:</span>
                            <span v-if="!isEditing(user.id)" class="info-value text-muted">
                              <i class="bi bi-lock-fill me-1"></i>••••••••
                            </span>
                            <input 
                              v-else
                              type="password" 
                              class="form-control form-control-sm edit-input"
                              v-model="editForms[user.id].password"
                              placeholder="Leave blank to keep current"
                              minlength="6"
                            />
                          </div>
                          <div class="info-row">
                            <span class="info-label">Joined:</span>
                            <span class="info-value">{{ formatDate(user.createdAt) }}</span>
                          </div>
                        </div>
                        
                        <!-- Role Management Section -->
                        <div class="info-section" v-if="user.role !== 'owner'">
                          <h6><i class="bi bi-shield-check me-2"></i>Role Upgrade</h6>
                          <div class="info-row">
                            <span class="info-label">Current Role:</span>
                            <span class="info-value">
                              <span v-if="user.role === 'admin'" class="role-badge admin">
                                <i class="bi bi-building me-1"></i>Admin
                              </span>
                              <span v-else class="role-badge doctor">
                                <i class="bi bi-person-badge me-1"></i>Doctor
                              </span>
                            </span>
                          </div>
                          <div class="info-row">
                            <span class="info-label">Upgrade Role:</span>
                            <div class="role-toggle-wrapper">
                              <label class="role-toggle" :data-user-id="user.id" :class="{ 
                                'upgrading': changingRole === user.id,
                                'upgraded': recentlyUpgraded === user.id,
                                'admin-active': user.role === 'admin' && changingRole !== user.id && !recentlyUpgraded
                              }">
                                <input 
                                  type="checkbox"
                                  :key="`role-toggle-${user.id}-${user.role}`"
                                  :checked="user.role === 'admin'"
                                  @change="toggleRole(user, $event)"
                                  :disabled="changingRole === user.id"
                                />
                                <span class="upgrade-button">
                                  <span class="upgrade-button-bg"></span>
                                  <span class="upgrade-button-content">
                                    <span class="upgrade-icon" v-if="user.role === 'doctor'">
                                      <i class="bi bi-arrow-up-circle-fill"></i>
                                    </span>
                                    <span class="upgrade-text" v-if="user.role === 'doctor'">Upgrade</span>
                                    <span class="upgrade-icon active" v-if="user.role === 'admin'">
                                      <i class="bi bi-check-circle-fill"></i>
                                    </span>
                                    <span class="upgrade-text active" v-if="user.role === 'admin'">Admin</span>
                                  </span>
                                  <span class="upgrade-button-shine"></span>
                                </span>
                                <span class="role-toggle-label">
                                  <span v-if="user.role === 'admin'" class="role-label-active">
                                    <i class="bi bi-building me-1"></i>Admin
                                  </span>
                                  <span v-else class="role-label-inactive">
                                    <i class="bi bi-person-badge me-1"></i>Doctor
                                  </span>
                                </span>
                              </label>
                              <div v-if="changingRole === user.id" class="upgrade-status">
                                <span class="upgrade-spinner">
                                  <i class="bi bi-arrow-repeat"></i>
                                </span>
                                <span class="upgrade-text">Upgrading...</span>
                              </div>
                              <div v-if="recentlyUpgraded === user.id" class="upgrade-success">
                                <span class="success-icon">
                                  <i class="bi bi-check-circle-fill"></i>
                                </span>
                                <span class="success-text">Upgraded!</span>
                                <span class="success-confetti">✨</span>
                              </div>
                            </div>
                          </div>
                          
                          <!-- Hospital Info Button (for admins) -->
                          <div v-if="user.role === 'admin'" class="info-row mt-3">
                            <div class="hospital-info-badge-wrapper">
                              <button 
                                type="button" 
                                class="hospital-info-badge"
                                @click="checkHospitalInfo(user)"
                                title="Check Hospital Information"
                              >
                                <div class="hospital-badge-icon">
                                  <i class="bi bi-hospital"></i>
                                </div>
                                <span class="hospital-badge-text">Hospital Info</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <!-- Status Section -->
                        <div class="info-section">
                          <h6><i class="bi bi-info-circle me-2"></i>Status</h6>
                          <div class="info-row">
                            <span class="info-label">Account Status:</span>
                            <span class="info-value">
                              <span v-if="user.blocked" class="status-badge blocked">
                                <i class="bi bi-slash-circle me-1"></i>Blocked
                              </span>
                              <span v-else class="status-badge active">
                                <i class="bi bi-check-circle me-1"></i>Active
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Actions -->
                      <div class="actions-section">
                        <span class="actions-label">Actions:</span>
                        <div class="action-buttons">
                          <template v-if="!isEditing(user.id)">
                            <button 
                              type="button" 
                              class="btn btn-sm btn-outline-primary action-btn-edit"
                              @click="startEdit(user)"
                              title="Edit User"
                            >
                              <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button 
                              v-if="user.role !== 'owner' && !user.blocked"
                              type="button" 
                              class="btn btn-sm btn-outline-danger action-btn"
                              @click="blockUser(user)"
                              title="Block User"
                            >
                              <i class="bi bi-slash-circle"></i> Block
                            </button>
                            <button 
                              v-if="user.role !== 'owner' && user.blocked"
                              type="button" 
                              class="btn btn-sm btn-outline-success action-btn"
                              @click="unblockUser(user)"
                              title="Unblock User"
                            >
                              <i class="bi bi-unlock"></i> Unblock
                            </button>
                          </template>
                          <template v-else>
                            <button 
                              type="button" 
                              class="btn btn-sm btn-success action-btn-save"
                              @click="saveUser(user)"
                              :disabled="editLoading === user.id"
                              title="Save Changes"
                            >
                              <span v-if="editLoading === user.id" class="spinner-border spinner-border-sm me-1"></span>
                              <i v-else class="bi bi-check-lg"></i> Save
                            </button>
                            <button 
                              type="button" 
                              class="btn btn-sm btn-outline-secondary action-btn-cancel"
                              @click="cancelEdit(user.id)"
                              :disabled="editLoading === user.id"
                              title="Cancel"
                            >
                              <i class="bi bi-x-lg"></i> Cancel
                            </button>
                          </template>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.pages > 1" class="pagination-section">
          <button 
            class="btn btn-sm btn-outline-secondary"
            :disabled="pagination.page <= 1"
            @click="goToPage(pagination.page - 1)"
          >
            <i class="bi bi-chevron-left"></i>
          </button>
          <span class="page-info">
            Page {{ pagination.page }} of {{ pagination.pages }}
          </span>
          <button 
            class="btn btn-sm btn-outline-secondary"
            :disabled="pagination.page >= pagination.pages"
            @click="goToPage(pagination.page + 1)"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>

      <!-- Block Confirmation Modal -->
      <div v-if="showBlockModal" class="modal-overlay" @click.self="showBlockModal = false">
        <div class="modal-dialog block-modal-dialog">
          <div class="modal-content block-modal-content">
            <div class="modal-header block-modal-header">
              <div class="block-header-content">
                <h5 class="modal-title">
                  Block User
                </h5>
                <button type="button" class="block-close-btn" @click="showBlockModal = false" aria-label="Close">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
            <form @submit.prevent="confirmBlock">
              <div class="modal-body block-modal-body">
                <p class="block-message">Are you sure you want to block <strong>@{{ userToBlock?.username }}</strong>?</p>
                <div class="block-reason-section">
                  <label for="blockReason" class="block-reason-label">Reason (optional)</label>
                  <textarea 
                    class="block-reason-input" 
                    id="blockReason" 
                    v-model="blockReason"
                    rows="3"
                    placeholder="Enter reason for blocking..."
                  ></textarea>
                </div>
                <div class="block-warning">
                  <i class="bi bi-info-circle me-2"></i>
                  <span>This user will not be able to log in until unblocked.</span>
                </div>
              </div>
              <div class="modal-footer block-modal-footer">
                <button type="button" class="btn btn-secondary block-btn-cancel" @click="showBlockModal = false">
                  Cancel
                </button>
                <button type="submit" class="btn block-btn-action" :disabled="blockLoading">
                  <span v-if="blockLoading" class="spinner-border spinner-border-sm me-2"></span>
                  {{ blockLoading ? 'Blocking...' : 'Block User' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Upgrade Confirmation Modal -->
      <div v-if="showUpgradeModal" class="modal-overlay" @click.self="cancelRoleChange">
        <div class="modal-dialog upgrade-modal-dialog">
          <div class="modal-content upgrade-modal-content">
            <div class="modal-header upgrade-modal-header">
              <div class="upgrade-header-content">
                <h5 class="modal-title">
                  {{ getUpgradeModalTitle() }}
                </h5>
                <button type="button" class="upgrade-close-btn" @click="cancelRoleChange" aria-label="Close">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
            <div class="modal-body upgrade-modal-body">
              <p class="upgrade-message">{{ getUpgradeModalMessage() }}</p>
            </div>
            <div class="modal-footer upgrade-modal-footer">
              <button type="button" class="btn btn-secondary upgrade-btn-cancel" @click="cancelRoleChange">
                Cancel
              </button>
              <button 
                type="button" 
                class="btn upgrade-btn-action" 
                :class="getUpgradeButtonClass()"
                @click="executeRoleChange"
              >
                {{ getUpgradeButtonText() }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Hospital Info Modal -->
      <div v-if="showHospitalInfoModal" class="modal-overlay" @click.self="closeHospitalInfoModal">
        <div class="modal-dialog hospital-info-modal-dialog">
          <div class="modal-content hospital-info-modal-content">
            <div class="modal-header hospital-info-modal-header">
              <div class="hospital-info-header-content">
                <h5 class="modal-title">
                  <i class="bi bi-hospital me-2"></i>Hospital Information
                </h5>
                <button type="button" class="hospital-info-close-btn" @click="closeHospitalInfoModal" aria-label="Close">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
            <div class="modal-body hospital-info-modal-body">
              <div v-if="hospitalInfoLoading" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
              <div v-else-if="hospitalInfo">
                <!-- Hospital Basic Info -->
                <div class="hospital-info-section">
                  <h6 class="section-title">
                    <i class="bi bi-building me-2"></i>Basic Information
                  </h6>
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">Hospital ID:</span>
                      <span class="info-value">{{ hospitalInfo.hospitalId }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Hospital Name:</span>
                      <span class="info-value">{{ hospitalInfo.name }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Address:</span>
                      <span class="info-value">{{ hospitalInfo.address || 'N/A' }}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Statistics -->
                <div class="hospital-info-section">
                  <h6 class="section-title">
                    <i class="bi bi-graph-up me-2"></i>Statistics
                  </h6>
                  <div class="stats-grid">
                    <div class="stat-card">
                      <div class="stat-icon">
                        <i class="bi bi-people"></i>
                      </div>
                      <div class="stat-content">
                        <div class="stat-value">{{ hospitalInfo.memberCount || 0 }}</div>
                        <div class="stat-label">Members</div>
                      </div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-icon dicom">
                        <i class="bi bi-file-earmark-medical"></i>
                      </div>
                      <div class="stat-content">
                        <div class="stat-value">{{ hospitalInfo.dicomCount || 0 }}</div>
                        <div class="stat-label">DICOM Files</div>
                      </div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-icon document">
                        <i class="bi bi-file-earmark-word"></i>
                      </div>
                      <div class="stat-content">
                        <div class="stat-value">{{ hospitalInfo.documentCount || 0 }}</div>
                        <div class="stat-label">Documents</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Subscription Info -->
                <div class="hospital-info-section">
                  <h6 class="section-title">
                    <i class="bi bi-calendar-check me-2"></i>Subscription
                  </h6>
                  <div v-if="hospitalInfo.subscription" class="subscription-info">
                    <div class="subscription-badge" :class="{
                      'badge-active': hospitalInfo.subscription.isActive,
                      'badge-expired': !hospitalInfo.subscription.isActive
                    }">
                      <i :class="hospitalInfo.subscription.planType === 'forever' ? 'bi bi-award-fill' : 
                                 hospitalInfo.subscription.planType === 'monthly' ? 'bi bi-calendar-week' : 
                                 'bi bi-calendar-range'" class="me-1"></i>
                      {{ hospitalInfo.subscription.planType === 'forever' ? 'Forever' : 
                         hospitalInfo.subscription.planType === 'monthly' ? 'Monthly' : 'Yearly' }} Plan
                    </div>
                    <div v-if="hospitalInfo.subscription.planType !== 'forever'" class="expiration-info">
                      <div class="expiration-row">
                        <span class="expiration-label">Expires:</span>
                        <span class="expiration-value">{{ formatDate(hospitalInfo.subscription.expiresAt) }}</span>
                      </div>
                      <div class="expiration-row">
                        <span class="expiration-label">Days Remaining:</span>
                        <span class="expiration-value" :class="{
                          'text-danger': hospitalInfo.subscription.daysUntilExpiration <= 3,
                          'text-warning': hospitalInfo.subscription.daysUntilExpiration > 3 && hospitalInfo.subscription.daysUntilExpiration <= 7
                        }">
                          {{ Math.max(0, hospitalInfo.subscription.daysUntilExpiration) }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div v-else class="no-subscription-message">
                    <i class="bi bi-info-circle me-2"></i>
                    <span>No subscription plan applied yet</span>
                  </div>
                </div>
                
                <!-- Apply Plan Section -->
                <div v-if="canApplyPlan" class="hospital-info-section plan-section">
                  <h6 class="section-title">
                    <i class="bi bi-magic me-2"></i>Apply New Plan
                  </h6>
                  <p class="plan-section-description">Select a new subscription plan to extend the hospital's access:</p>
                  <div class="plan-options">
                    <div 
                      v-for="plan in subscriptionPlans" 
                      :key="plan.value"
                      class="plan-card"
                      :class="{ 'selected': selectedHospitalPlan === plan.value }"
                      @click="selectedHospitalPlan = plan.value"
                    >
                      <div class="plan-icon">
                        <i :class="plan.icon"></i>
                      </div>
                      <div class="plan-info">
                        <h6 class="plan-name">{{ plan.name }}</h6>
                        <p class="plan-description">{{ plan.description }}</p>
                      </div>
                      <div class="plan-check" v-if="selectedHospitalPlan === plan.value">
                        <i class="bi bi-check-circle-fill"></i>
                      </div>
                    </div>
                  </div>
                  <div class="apply-plan-button-wrapper">
                    <button 
                      class="btn apply-plan-btn"
                      :disabled="!selectedHospitalPlan || applyingPlan"
                      @click="applyHospitalPlan"
                    >
                      <span v-if="applyingPlan" class="spinner-border spinner-border-sm me-2"></span>
                      <i v-else class="bi bi-sparkles me-2"></i>
                      {{ applyingPlan ? 'Applying...' : 'Apply Plan' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer hospital-info-modal-footer">
              <button 
                v-if="hospitalInfo && hospitalInfo.subscription && hospitalInfo.subscription.isActive"
                type="button" 
                class="btn btn-outline-danger expire-btn"
                :disabled="expiringHospital"
                @click="expireHospital"
              >
                <span v-if="expiringHospital" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-x-circle me-2"></i>
                {{ expiringHospital ? 'Expiring...' : 'Expire Hospital' }}
              </button>
              <button 
                type="button" 
                class="btn btn-secondary"
                @click="closeHospitalInfoModal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { orthancApiUrl } from '../globalConfigurations';

export default {
  name: 'UserManagement',
  data() {
    return {
      users: [],
      loading: true,
      searchQuery: '',
      filterRole: '',
      filterBlocked: '',
      roles: [
        { value: '', label: 'All Roles', icon: 'bi bi-people' },
        { value: 'doctor', label: 'Doctors', icon: 'bi bi-person-badge' },
        { value: 'admin', label: 'Admins', icon: 'bi bi-building' },
        { value: 'owner', label: 'Owner', icon: 'bi bi-shield-check' }
      ],
      stats: {
        totalUsers: 0,
        doctorCount: 0,
        adminCount: 0,
        ownerCount: 0,
        blockedCount: 0
      },
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      },
      changingRole: null,
      showBlockModal: false,
      userToBlock: null,
      blockReason: '',
      blockLoading: false,
      searchTimeout: null,
      expandedUserId: null,
      editingUserId: null,
      editForms: {},
      editLoading: null,
      searchInputReadonly: true,
      recentlyUpgraded: null,
      // Upgrade confirmation modal
      showUpgradeModal: false,
      userToUpgrade: null,
      pendingUpgradeEvent: null,
      pendingUpgradeRole: null,
      // Hospital info modal
      showHospitalInfoModal: false,
      hospitalInfo: null,
      hospitalInfoLoading: false,
      selectedHospitalPlan: null,
      applyingPlan: false,
      expiringHospital: false,
      currentAdminUser: null
    };
  },
  computed: {
    subscriptionPlans() {
      return [
        {
          value: 'monthly',
          name: 'Monthly',
          description: '30 days access',
          icon: 'bi bi-calendar-week'
        },
        {
          value: 'yearly',
          name: 'Yearly',
          description: '365 days access',
          icon: 'bi bi-calendar-range'
        },
        {
          value: 'forever',
          name: 'Forever',
          description: 'Unlimited access',
          icon: 'bi bi-award-fill'
        }
      ];
    },
    canApplyPlan() {
      if (!this.hospitalInfo) return false;
      // Allow if no subscription (new hospital) or expired or ≤3 days remaining
      if (!this.hospitalInfo.subscription) return true;
      const days = this.hospitalInfo.subscription.daysUntilExpiration;
      return days <= 3 || !this.hospitalInfo.subscription.isActive;
    }
  },
  async mounted() {
    await this.loadUsers();
    await this.loadStats();
  },
  methods: {
    async loadUsers() {
      this.loading = true;
      
      try {
        const token = localStorage.getItem('auth-token');
        const params = new URLSearchParams({
          page: this.pagination.page,
          limit: this.pagination.limit
        });
        
        if (this.filterRole) {
          params.append('role', this.filterRole);
        }
        if (this.filterBlocked) {
          params.append('blocked', this.filterBlocked);
        }
        if (this.searchQuery) {
          params.append('search', this.searchQuery);
        }
        
        const response = await axios.get(
          `${orthancApiUrl}api/users?${params.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.users = response.data.users;
          this.pagination = response.data.pagination;
        }
      } catch (error) {
        console.error('Error loading users:', error);
        if (error.response?.status === 403) {
          alert('Access denied. Only owner can manage users.');
          this.$router.push('/');
        }
      } finally {
        this.loading = false;
      }
    },
    
    async loadStats() {
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.get(
          `${orthancApiUrl}api/users/stats/overview`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.stats = response.data.stats;
        }
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    },
    
    handleSearchFocus(event) {
      // Remove readonly attribute to allow typing
      if (event.target.hasAttribute('readonly')) {
        event.target.removeAttribute('readonly');
        this.searchInputReadonly = false;
      }
    },
    
    debouncedSearch() {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      this.searchTimeout = setTimeout(() => {
        this.pagination.page = 1;
        this.loadUsers();
      }, 300);
    },
    
    goToPage(page) {
      this.pagination.page = page;
      this.loadUsers();
    },
    
    async toggleRole(user, event) {
      const currentRole = user.role;
      const newRole = currentRole === 'admin' ? 'doctor' : 'admin';
      
      // Store the user and event for later execution
      this.userToUpgrade = user;
      this.pendingUpgradeEvent = event;
      this.pendingUpgradeRole = { currentRole, newRole };
      
      // Show custom confirmation modal
      this.showUpgradeModal = true;
    },
    
    async executeRoleChange() {
      if (!this.userToUpgrade || !this.pendingUpgradeEvent || !this.pendingUpgradeRole) {
        return;
      }
      
      const { currentRole, newRole } = this.pendingUpgradeRole;
      const user = this.userToUpgrade;
      const event = this.pendingUpgradeEvent;
      
      // Close modal
      this.showUpgradeModal = false;
      
      // Clear any previous success state
      this.recentlyUpgraded = null;
      this.changingRole = user.id;
      
      try {
        const token = localStorage.getItem('auth-token');
        
        await axios.put(
          `${orthancApiUrl}api/users/${user.id}/role`,
          { role: newRole },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        user.role = newRole;
        await this.loadStats();
        
        // Show success animation with smooth fade-out
        this.recentlyUpgraded = user.id;
        
        // Smooth fade-out: start fading after 1.5s, complete by 3s
        setTimeout(() => {
          if (this.recentlyUpgraded === user.id) {
            // Add fade-out class for smooth transition
            const toggleElement = document.querySelector(`[data-user-id="${user.id}"] .role-toggle`);
            if (toggleElement) {
              toggleElement.classList.add('fading-out');
            }
          }
        }, 1500);
        
        // Remove success animation after smooth fade-out
        setTimeout(() => {
          if (this.recentlyUpgraded === user.id) {
            this.recentlyUpgraded = null;
          }
        }, 3000);
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to change role');
        // Reset checkbox state on error
        event.target.checked = currentRole === 'admin';
      } finally {
        this.changingRole = null;
        // Clear pending upgrade data
        this.userToUpgrade = null;
        this.pendingUpgradeEvent = null;
        this.pendingUpgradeRole = null;
      }
    },
    
    cancelRoleChange() {
      if (this.pendingUpgradeEvent && this.pendingUpgradeRole) {
        // Reset checkbox state if cancelled
        this.pendingUpgradeEvent.target.checked = this.pendingUpgradeRole.currentRole === 'admin';
      }
      this.showUpgradeModal = false;
      this.userToUpgrade = null;
      this.pendingUpgradeEvent = null;
      this.pendingUpgradeRole = null;
    },
    
    getUpgradeModalTitle() {
      if (!this.pendingUpgradeRole) return 'Change Role';
      return this.pendingUpgradeRole.newRole === 'admin' 
        ? 'Upgrade to Admin' 
        : 'Downgrade to Doctor';
    },
    
    getUpgradeModalMessage() {
      if (!this.userToUpgrade || !this.pendingUpgradeRole) return '';
      const { newRole } = this.pendingUpgradeRole;
      return newRole === 'admin' 
        ? `Upgrade @${this.userToUpgrade.username} to admin? They will be able to create and manage a hospital.`
        : `Downgrade @${this.userToUpgrade.username} to doctor? If they have a hospital, it will be deleted.`;
    },
    
    getUpgradeButtonClass() {
      if (!this.pendingUpgradeRole) return 'btn-primary';
      return this.pendingUpgradeRole.newRole === 'admin' ? 'btn-primary' : 'btn-warning';
    },
    
    getUpgradeButtonText() {
      if (!this.pendingUpgradeRole) return 'Confirm';
      return this.pendingUpgradeRole.newRole === 'admin' ? 'Upgrade' : 'Downgrade';
    },
    
    async checkHospitalInfo(user) {
      this.hospitalInfoLoading = true;
      this.showHospitalInfoModal = true;
      this.hospitalInfo = null;
      this.selectedHospitalPlan = null;
      this.currentAdminUser = user;
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.get(
          `${orthancApiUrl}api/users/${user.id}/hospital-info`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          if (response.data.hospital) {
            this.hospitalInfo = response.data.hospital;
          } else {
            // Show toast notification
            if (this.messageBus) {
              this.messageBus.emit('show-info-toast', 'The user didn\'t create the hospital yet.');
            } else {
              alert('The user didn\'t create the hospital yet.');
            }
            this.showHospitalInfoModal = false;
          }
        }
      } catch (error) {
        console.error('Error loading hospital info:', error);
        if (error.response?.status === 404 || error.response?.data?.message) {
          // Show toast notification
          if (this.messageBus) {
            this.messageBus.emit('show-info-toast', 'The user didn\'t create the hospital yet.');
          } else {
            alert('The user didn\'t create the hospital yet.');
          }
        } else {
          if (this.messageBus) {
            this.messageBus.emit('show-error-toast', error.response?.data?.error || 'Failed to load hospital info');
          } else {
            alert(error.response?.data?.error || 'Failed to load hospital info');
          }
        }
        this.showHospitalInfoModal = false;
      } finally {
        this.hospitalInfoLoading = false;
      }
    },
    
    closeHospitalInfoModal() {
      this.showHospitalInfoModal = false;
      this.hospitalInfo = null;
      this.selectedHospitalPlan = null;
      this.currentAdminUser = null;
    },
    
    async applyHospitalPlan() {
      if (!this.selectedHospitalPlan) {
        alert('Please select a plan');
        return;
      }
      
      if (!this.hospitalInfo) return;
      
      this.applyingPlan = true;
      
      try {
        const token = localStorage.getItem('auth-token');
        // Use hospital MongoDB _id for the subscription endpoint
        const response = await axios.post(
          `${orthancApiUrl}api/subscriptions/${this.hospitalInfo.id}`,
          { planType: this.selectedHospitalPlan },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          // Reload hospital info
          if (this.currentAdminUser) {
            await this.checkHospitalInfo(this.currentAdminUser);
          }
          this.selectedHospitalPlan = null;
          alert('Plan applied successfully!');
        }
      } catch (error) {
        console.error('Error applying plan:', error);
        alert(error.response?.data?.error || 'Failed to apply plan');
      } finally {
        this.applyingPlan = false;
      }
    },
    
    async expireHospital() {
      if (!confirm('Are you sure you want to expire this hospital? This will suspend the hospital immediately.')) {
        return;
      }
      
      if (!this.hospitalInfo || !this.currentAdminUser) return;
      
      this.expiringHospital = true;
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.post(
          `${orthancApiUrl}api/users/${this.currentAdminUser.id}/expire-hospital`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          // Reload hospital info
          await this.checkHospitalInfo(this.currentAdminUser);
          alert('Hospital expired successfully!');
        }
      } catch (error) {
        console.error('Error expiring hospital:', error);
        alert(error.response?.data?.error || 'Failed to expire hospital');
      } finally {
        this.expiringHospital = false;
      }
    },
    
    startEdit(user) {
      // Ensure row is expanded when starting to edit
      if (this.expandedUserId !== user.id) {
        this.expandedUserId = user.id;
      }
      this.editingUserId = user.id;
      this.editForms[user.id] = {
        username: user.username,
        name: user.name,
        email: user.email,
        password: ''
      };
      
      // Prevent browser autofill from filling search box with email
      // Check immediately and after DOM updates
      const checkAndClearAutofill = () => {
        if (this.searchQuery === user.email) {
          this.searchQuery = '';
        }
      };
      
      // Check immediately
      checkAndClearAutofill();
      
      // Check after DOM updates (browser autofill might happen asynchronously)
      this.$nextTick(() => {
        checkAndClearAutofill();
        // Also check after a short delay to catch delayed autofill
        setTimeout(checkAndClearAutofill, 100);
      });
    },
    
    cancelEdit(userId) {
      this.editingUserId = null;
      delete this.editForms[userId];
      // Optionally collapse the row after canceling
      this.expandedUserId = null;
    },
    
    async saveUser(user) {
      this.editLoading = user.id;
      
      try {
        const token = localStorage.getItem('auth-token');
        const editForm = this.editForms[user.id];
        const updateData = {
          username: editForm.username,
          name: editForm.name,
          email: editForm.email
        };
        
        // Only include password if provided
        if (editForm.password && editForm.password.trim() !== '') {
          updateData.password = editForm.password;
        }
        
        await axios.put(
          `${orthancApiUrl}api/users/${user.id}`,
          updateData,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        // Update local user data
        user.username = editForm.username;
        user.name = editForm.name;
        user.email = editForm.email;
        
        this.cancelEdit(user.id);
        alert('User updated successfully');
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to update user');
      } finally {
        this.editLoading = null;
      }
    },
    
    isEditing(userId) {
      return this.editingUserId === userId;
    },
    
    blockUser(user) {
      this.userToBlock = user;
      this.blockReason = '';
      this.showBlockModal = true;
    },
    
    async confirmBlock() {
      this.blockLoading = true;
      
      try {
        const token = localStorage.getItem('auth-token');
        await axios.put(
          `${orthancApiUrl}api/users/${this.userToBlock.id}/block`,
          { reason: this.blockReason },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        this.userToBlock.blocked = true;
        this.userToBlock.blockedBy = 'owner';
        this.userToBlock.blockedReason = this.blockReason;
        this.showBlockModal = false;
        await this.loadStats();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to block user');
      } finally {
        this.blockLoading = false;
      }
    },
    
    async unblockUser(user) {
      if (!confirm(`Unblock @${user.username}?`)) return;
      
      try {
        const token = localStorage.getItem('auth-token');
        await axios.put(
          `${orthancApiUrl}api/users/${user.id}/unblock`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        user.blocked = false;
        user.blockedBy = null;
        user.blockedReason = '';
        await this.loadStats();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to unblock user');
      }
    },
    
    formatDate(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    },
    
    toggleExpand(userId) {
      // Don't collapse if user is in edit mode
      if (this.expandedUserId === userId && this.editingUserId !== userId) {
        this.expandedUserId = null;
      } else if (this.expandedUserId !== userId) {
        this.expandedUserId = userId;
      }
    },
    
    isExpanded(userId) {
      return this.expandedUserId === userId;
    }
  }
};
</script>

<style scoped>
.user-management {
  padding: 20px;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.stats-badges {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  background: #f3f4f6;
  color: #4b5563;
}

.stat-badge.doctors {
  background: #e0f2fe;
  color: #0369a1;
}

.stat-badge.admins {
  background: #fef3c7;
  color: #92400e;
}

.stat-badge.blocked {
  background: #fee2e2;
  color: #991b1b;
}

.filters-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-box {
  position: relative;
  max-width: 400px;
}

.search-box i {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
}

.search-box .form-control {
  padding-left: 40px;
  border-radius: 8px;
}

.filter-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-filter {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  color: #4b5563;
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
}

.btn-filter:hover {
  background: #e5e7eb;
}

.btn-filter.active {
  background: #4a90e2;
  border-color: #4a90e2;
  color: white;
}

.card {
  border: none;
  border-radius: 12px;
}

.table {
  margin: 0;
}

.table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  padding: 14px 16px;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  text-align: left;
}

.table td {
  padding: 14px 16px;
  vertical-align: middle;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  text-align: left;
}

.table tbody tr {
  transition: background-color 0.2s ease;
}

.table tbody tr:hover:not(.data-row-expanded) {
  background-color: #f9fafb;
}

.blocked-row {
  background: #fef2f2;
}

.blocked-row:hover:not(.data-row-expanded) {
  background-color: #fee2e2 !important;
}

.username {
  font-weight: 500;
  color: #4a90e2;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
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

.role-toggle input[type="checkbox"]:disabled + .role-toggle-slider {
  opacity: 0.7;
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

.upgrade-text {
  color: #4a90e2;
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

.success-confetti {
  font-size: 16px;
  animation: confetti-float 2s ease-out infinite;
  display: inline-block;
}

/* Natural Animations */
@keyframes natural-pulse {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.6;
  }
}

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

@keyframes smooth-fade-out {
  0% {
    transform: scale(1);
    box-shadow: 
      0 0 20px rgba(59, 130, 246, 0.4),
      inset 0 2px 4px rgba(0, 0, 0, 0.06);
  }
  100% {
    transform: scale(1);
    box-shadow: 
      0 0 20px rgba(59, 130, 246, 0.4),
      inset 0 2px 4px rgba(0, 0, 0, 0.06);
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

@keyframes natural-glow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes success-fade-in {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes success-scale {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes confetti-float {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(-20px) rotate(360deg);
    opacity: 0.5;
  }
}

@keyframes confetti-burst {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: translate(-10px, -10px) scale(1.2) rotate(120deg);
  }
  60% {
    opacity: 0.8;
    transform: translate(-15px, -20px) scale(1) rotate(240deg);
  }
  100% {
    opacity: 0;
    transform: translate(-20px, -30px) scale(0.8) rotate(360deg);
  }
}

.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
}

.role-badge.owner {
  background: #ede9fe;
  color: #6b21a8;
}

.role-badge.admin {
  background: #fef3c7;
  color: #92400e;
}

.role-badge.doctor {
  background: #e0f2fe;
  color: #0369a1;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.active {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.blocked {
  background: #fee2e2;
  color: #991b1b;
}

.action-buttons {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.action-buttons .btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.pagination-section {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid #e5e7eb;
}

.page-info {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 20px;
  animation: fade-in 0.2s ease-out;
}

.modal-dialog {
  width: 100%;
  max-width: 500px;
}

.modal-dialog.modal-lg {
  max-width: 700px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  font-weight: 600;
  margin: 0;
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.alert-warning {
  border-radius: 8px;
  border: none;
  background-color: #fef3c7;
  color: #92400e;
}

/* Block Modal - Modern & Simple */
.block-modal-dialog {
  max-width: 450px;
  animation: modal-fade-in 0.2s ease-out;
}

.block-modal-content {
  border: none;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  background: white;
}

.block-modal-header {
  padding: 0;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.block-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 20px 24px;
  gap: 16px;
}

.block-modal-header .modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  flex: 1;
  color: #111827;
}

.block-close-btn {
  flex-shrink: 0;
  margin: 0;
  padding: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: #6b7280;
  font-size: 18px;
  line-height: 1;
}

.block-close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.block-close-btn:active {
  background: #e5e7eb;
}

.block-modal-body {
  padding: 24px;
  background: white;
}

.block-message {
  margin: 0 0 20px 0;
  font-size: 15px;
  line-height: 1.6;
  color: #374151;
}

.block-message strong {
  color: #111827;
  font-weight: 600;
}

.block-reason-section {
  margin-bottom: 20px;
}

.block-reason-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.block-reason-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: all 0.2s ease;
  background: white;
  color: #374151;
}

.block-reason-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.block-reason-input::placeholder {
  color: #9ca3af;
}

.block-warning {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  background: #fef3c7;
  border-radius: 8px;
  font-size: 14px;
  color: #92400e;
  line-height: 1.5;
}

.block-warning i {
  flex-shrink: 0;
  margin-top: 2px;
}

.block-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: white;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.block-btn-cancel {
  min-width: 90px;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.block-btn-cancel:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #111827;
}

.block-btn-action {
  min-width: 110px;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: none;
  background: #ef4444;
  color: white;
}

.block-btn-action:hover:not(:disabled) {
  background: #dc2626;
}

.block-btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modal-fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Upgrade Modal - Modern & Simple */
.upgrade-modal-dialog {
  max-width: 450px;
  animation: modal-fade-in 0.2s ease-out;
}

.upgrade-modal-content {
  border: none;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  background: white;
}

.upgrade-modal-header {
  padding: 0;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.upgrade-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 20px 24px;
  gap: 16px;
}

.upgrade-modal-header .modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  flex: 1;
  color: #111827;
}

.upgrade-close-btn {
  flex-shrink: 0;
  margin: 0;
  padding: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: #6b7280;
  font-size: 18px;
  line-height: 1;
}

.upgrade-close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.upgrade-close-btn:active {
  background: #e5e7eb;
}

.upgrade-modal-body {
  padding: 24px;
  background: white;
}

.upgrade-message {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: #374151;
}

.upgrade-message strong {
  color: #111827;
  font-weight: 600;
}

.plan-selection-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.plan-selection-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
}

.plan-selection-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 16px 0;
}

.plan-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-card {
  position: relative;
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.plan-card:hover {
  border-color: #3b82f6;
  background: #f8fafc;
}

.plan-card.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.plan-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border-radius: 10px;
  margin-right: 16px;
  font-size: 24px;
  color: #6b7280;
  transition: all 0.2s ease;
}

.plan-card.selected .plan-icon {
  background: #3b82f6;
  color: white;
}

.plan-info {
  flex: 1;
}

.plan-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px 0;
}

.plan-description {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.plan-check {
  position: absolute;
  top: 16px;
  right: 16px;
  color: #3b82f6;
  font-size: 20px;
}

.plan-error {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 13px;
  display: flex;
  align-items: center;
}

.upgrade-btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upgrade-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: white;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.upgrade-btn-cancel {
  min-width: 90px;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.upgrade-btn-cancel:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #111827;
}

.upgrade-btn-action {
  min-width: 110px;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: none;
}

.upgrade-btn-action.btn-primary {
  background: #3b82f6;
  color: white;
}

.upgrade-btn-action.btn-primary:hover {
  background: #2563eb;
}

.upgrade-btn-action.btn-warning {
  background: #f59e0b;
  color: white;
}

.upgrade-btn-action.btn-warning:hover {
  background: #d97706;
}

/* Expanded row styles */
.data-row-expanded {
  background-color: #f8f9fa !important;
  font-weight: 600;
}

.data-row-expanded > td {
  background-color: #f8f9fa !important;
}

.details-row {
  background-color: #f8f9fa !important;
}

.details-row > td {
  background-color: #f8f9fa !important;
  padding: 0 !important;
}

.details-content {
  padding: 24px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e5e7eb;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
  margin-bottom: 20px;
}

.info-section h6 {
  margin-bottom: 16px;
  color: #374151;
  font-weight: 600;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  display: flex;
  align-items: center;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.hospital-info-badge-wrapper {
  width: 100%;
}

.hospital-info-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  border: 2px solid #0ea5e9;
  border-radius: 12px;
  color: #0369a1;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.hospital-info-badge::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transition: left 0.5s ease;
}

.hospital-info-badge:hover::before {
  left: 100%;
}

.hospital-info-badge:hover {
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  border-color: #0284c7;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
}

.hospital-info-badge:active {
  transform: translateY(0);
}

.hospital-badge-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(14, 165, 233, 0.15);
  border-radius: 8px;
  font-size: 18px;
  color: #0ea5e9;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.hospital-info-badge:hover .hospital-badge-icon {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  transform: scale(1.1);
}

.hospital-badge-text {
  flex: 1;
  text-align: left;
}

.info-label {
  font-weight: 500;
  color: #6b7280;
  min-width: 140px;
  margin-right: 12px;
  text-align: left;
}

.info-value {
  color: #374151;
  font-weight: 400;
  flex: 1;
  text-align: left;
}

.actions-section {
  display: flex;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
  margin-top: 8px;
}

.actions-label {
  font-weight: 600;
  margin-right: 16px;
  color: #374151;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.action-btn {
  margin-right: 8px;
  border-radius: 6px;
  padding: 6px 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  min-width: 75px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-btn-edit {
  margin-right: 8px;
  border-radius: 6px;
  padding: 6px 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid #4a90e2;
  color: #4a90e2;
  min-width: 75px;
  background: transparent;
}

.action-btn-edit:hover {
  background: #4a90e2;
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
}

.action-btn-save {
  margin-right: 8px;
  border-radius: 6px;
  padding: 6px 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  background: #10b981;
  border: 1px solid #10b981;
  min-width: 75px;
  color: white;
}

.action-btn-save:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.action-btn-save:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.action-btn-cancel {
  margin-right: 8px;
  border-radius: 6px;
  padding: 6px 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid #6b7280;
  color: #6b7280;
  min-width: 75px;
  background: transparent;
}

.action-btn-cancel:hover:not(:disabled) {
  background: #6b7280;
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3);
}

.action-btn-cancel:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.edit-input {
  flex: 1;
  max-width: 300px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.edit-input:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}

@media (max-width: 768px) {
  .header-section {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .search-box {
    max-width: 100%;
    width: 100%;
  }
  
  .filter-row {
    flex-direction: column;
  }
  
  .table-responsive {
    font-size: 0.875rem;
  }
  
  .details-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .info-label {
    min-width: 100px;
  }
}
/* Hospital Info Modal Styles */
.hospital-info-modal-dialog {
  max-width: 700px;
  animation: modal-fade-in 0.2s ease-out;
}

.hospital-info-modal-content {
  border: none;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  background: white;
}

.hospital-info-modal-header {
  padding: 0;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.hospital-info-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 20px 24px;
  gap: 16px;
}

.hospital-info-modal-header .modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  flex: 1;
  color: #111827;
  display: flex;
  align-items: center;
}

.hospital-info-close-btn {
  flex-shrink: 0;
  margin: 0;
  padding: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: #6b7280;
  font-size: 18px;
  line-height: 1;
}

.hospital-info-close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.hospital-info-modal-body {
  padding: 24px;
  background: white;
  max-height: 70vh;
  overflow-y: auto;
}

.hospital-info-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.hospital-info-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

.info-value {
  font-size: 15px;
  color: #111827;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.stat-card:hover {
  background: #f1f3f5;
  border-color: #d1d5db;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3b82f6;
  border-radius: 10px;
  margin-right: 12px;
  font-size: 24px;
  color: white;
}

.stat-icon.dicom {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.document {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
  margin-top: 2px;
}

.subscription-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subscription-badge {
  display: inline-flex;
  align-items: center;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  width: fit-content;
}

.subscription-badge.badge-active {
  background: #dbeafe;
  color: #1e40af;
}

.subscription-badge.badge-expired {
  background: #fee2e2;
  color: #991b1b;
}

.expiration-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.expiration-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.expiration-label {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.expiration-value {
  font-size: 14px;
  color: #111827;
  font-weight: 600;
}

.plan-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  border-radius: 12px;
  margin-top: 20px;
}

.plan-section .section-title {
  color: white;
}

.plan-section-description {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  margin: 0 0 16px 0;
}

.plan-section .plan-options {
  margin-bottom: 20px;
}

.plan-section .plan-card {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(255, 255, 255, 0.3);
}

.plan-section .plan-card:hover {
  background: white;
  border-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.plan-section .plan-card.selected {
  background: white;
  border-color: white;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.apply-plan-btn {
  width: 100%;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
}

.apply-plan-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.5s ease;
}

.apply-plan-btn:hover::before {
  left: 100%;
}

.apply-plan-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 87, 108, 0.5);
  background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
}

.apply-plan-btn:active:not(:disabled) {
  transform: translateY(0);
}

.apply-plan-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.apply-plan-button-wrapper {
  margin-top: 24px;
}

.hospital-info-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.expire-btn {
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.expire-btn:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
  color: white;
}

.expire-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.no-subscription-message {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f3f4f6;
  border-radius: 8px;
  color: #6b7280;
  font-size: 14px;
}

.no-subscription-message i {
  color: #9ca3af;
}

</style>
