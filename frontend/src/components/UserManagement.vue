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
                              <label class="role-toggle" :class="{ 'upgrading': changingRole === user.id }">
                                <input 
                                  type="checkbox"
                                  :key="`role-toggle-${user.id}-${user.role}`"
                                  :checked="user.role === 'admin'"
                                  @change="toggleRole(user, $event)"
                                  :disabled="changingRole === user.id"
                                />
                                <span class="role-toggle-slider">
                                  <span class="role-toggle-glow"></span>
                                </span>
                                <span class="role-toggle-label">
                                  <span v-if="user.role === 'admin'">Admin</span>
                                  <span v-else>Doctor</span>
                                </span>
                              </label>
                              <span v-if="changingRole === user.id" class="ms-2">
                                <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
                              </span>
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
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title text-danger">
                <i class="bi bi-slash-circle me-2"></i>Block User
              </h5>
              <button type="button" class="btn-close" @click="showBlockModal = false"></button>
            </div>
            <form @submit.prevent="confirmBlock">
              <div class="modal-body">
                <p>Are you sure you want to block <strong>@{{ userToBlock?.username }}</strong>?</p>
                <div class="mb-3">
                  <label for="blockReason" class="form-label">Reason (optional)</label>
                  <textarea 
                    class="form-control" 
                    id="blockReason" 
                    v-model="blockReason"
                    rows="2"
                    placeholder="Enter reason for blocking..."
                  ></textarea>
                </div>
                <div class="alert alert-warning mb-0">
                  <i class="bi bi-exclamation-triangle me-1"></i>
                  This user will not be able to log in until unblocked.
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showBlockModal = false">Cancel</button>
                <button type="submit" class="btn btn-danger" :disabled="blockLoading">
                  <span v-if="blockLoading" class="spinner-border spinner-border-sm me-2"></span>
                  {{ blockLoading ? 'Blocking...' : 'Block User' }}
                </button>
              </div>
            </form>
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
      editLoading: null
    };
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
      
      const confirmMsg = newRole === 'admin' 
        ? `Upgrade @${user.username} to admin? They will be able to create and manage a hospital.`
        : `Downgrade @${user.username} to doctor? If they have a hospital, it will be deleted.`;
      
      if (!confirm(confirmMsg)) {
        // Reset checkbox state if cancelled
        event.target.checked = currentRole === 'admin';
        return;
      }
      
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
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to change role');
        // Reset checkbox state on error
        event.target.checked = currentRole === 'admin';
      } finally {
        this.changingRole = null;
      }
    },
    
    startEdit(user) {
      console.log("Hellos", user);
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
    },
    
    cancelEdit(userId) {
      this.editingUserId = null;
      delete this.editForms[userId];
      // Optionally collapse the row after canceling
      // this.expandedUserId = null;
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

/* Role Toggle Switch */
.role-toggle-wrapper {
  display: flex;
  align-items: center;
  flex: 1;
}

.role-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.role-toggle input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.role-toggle-slider {
  position: relative;
  width: 56px;
  height: 30px;
  background: linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%);
  border-radius: 30px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.role-toggle-slider::before {
  content: '';
  position: absolute;
  width: 24px;
  height: 24px;
  left: 3px;
  top: 3px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 50%;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1);
  z-index: 2;
}

.role-toggle-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 30px;
  background: radial-gradient(circle, rgba(74, 144, 226, 0.4) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.role-toggle input[type="checkbox"]:checked + .role-toggle-slider {
  background: linear-gradient(135deg, #4a90e2 0%, #2563eb 100%);
  box-shadow: 0 0 20px rgba(74, 144, 226, 0.4), inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.role-toggle input[type="checkbox"]:checked + .role-toggle-slider::before {
  transform: translateX(26px);
  box-shadow: 0 2px 12px rgba(74, 144, 226, 0.5), 0 1px 4px rgba(0, 0, 0, 0.2);
}

.role-toggle input[type="checkbox"]:checked + .role-toggle-slider .role-toggle-glow {
  opacity: 1;
  animation: pulse-glow 1.5s ease-in-out infinite;
}

.role-toggle.upgrading .role-toggle-slider {
  animation: upgrade-pulse 0.6s ease-in-out;
}

.role-toggle input[type="checkbox"]:disabled + .role-toggle-slider {
  opacity: 0.6;
  cursor: not-allowed;
}

.role-toggle-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  user-select: none;
  transition: color 0.3s ease;
}

.role-toggle input[type="checkbox"]:checked ~ .role-toggle-label {
  color: #4a90e2;
  font-weight: 600;
}

@keyframes pulse-glow {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

@keyframes upgrade-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 20px rgba(74, 144, 226, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(74, 144, 226, 0.6);
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
</style>
