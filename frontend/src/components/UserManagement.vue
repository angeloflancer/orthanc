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
                <th>Username</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th class="text-end">Actions</th>
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
              <tr v-for="user in users" :key="user.id" :class="{ 'blocked-row': user.blocked }">
                <td>
                  <span class="username">@{{ user.username }}</span>
                </td>
                <td>{{ user.name }}</td>
                <td>{{ user.email }}</td>
                <td>
                  <div class="role-select-wrapper" v-if="user.role !== 'owner'">
                    <select 
                      class="form-select form-select-sm role-select"
                      :value="user.role"
                      @change="changeRole(user, $event.target.value)"
                      :disabled="changingRole === user.id"
                    >
                      <option value="doctor">Doctor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <span v-else class="role-badge owner">
                    <i class="bi bi-shield-check me-1"></i>Owner
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
                <td class="text-end">
                  <div class="action-buttons" v-if="user.role !== 'owner'">
                    <button 
                      v-if="!user.blocked"
                      class="btn btn-sm btn-danger"
                      @click="blockUser(user)"
                      title="Block User"
                    >
                      <i class="bi bi-slash-circle"></i>
                    </button>
                    <button 
                      v-else
                      class="btn btn-sm btn-success"
                      @click="unblockUser(user)"
                      title="Unblock User"
                    >
                      <i class="bi bi-unlock"></i>
                    </button>
                  </div>
                  <span v-else class="text-muted">-</span>
                </td>
              </tr>
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
      searchTimeout: null
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
    
    async changeRole(user, newRole) {
      if (newRole === user.role) return;
      
      const confirmMsg = newRole === 'admin' 
        ? `Make @${user.username} an admin? They will be able to create and manage a hospital.`
        : `Change @${user.username} to doctor? If they have a hospital, it will be deleted.`;
      
      if (!confirm(confirmMsg)) return;
      
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
      } finally {
        this.changingRole = null;
      }
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
  font-size: 0.875rem;
}

.table td {
  padding: 14px 16px;
  vertical-align: middle;
  border-bottom: 1px solid #f3f4f6;
}

.blocked-row {
  background: #fef2f2;
}

.username {
  font-weight: 500;
  color: #4a90e2;
}

.role-select-wrapper {
  display: inline-block;
}

.role-select {
  border-radius: 6px;
  font-size: 0.875rem;
  padding: 4px 28px 4px 10px;
  min-width: 100px;
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
}
</style>
