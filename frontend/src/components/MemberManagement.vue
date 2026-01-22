<template>
  <div class="member-management">
    <div class="container-fluid py-4">
      <div class="header-section">
        <h2 class="mb-0">Hospital Members</h2>
        <button class="btn btn-primary" @click="showInviteModal = true">
          <i class="bi bi-person-plus me-2"></i>Invite Doctor
        </button>
      </div>

      <!-- No Hospital Warning -->
      <div v-if="!hasHospital && !loading" class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        You need to create a hospital first before managing members.
        <router-link to="/hospital-settings" class="alert-link ms-2">Create Hospital</router-link>
      </div>

      <!-- Filters -->
      <div v-if="hasHospital" class="filters-section mb-4">
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
        <div class="filter-buttons">
          <button 
            v-for="status in statuses" 
            :key="status.value"
            class="btn btn-filter"
            :class="{ active: filterStatus === status.value }"
            @click="filterStatus = status.value; loadMembers()"
          >
            {{ status.label }}
            <span v-if="statusCounts[status.value]" class="count-badge">
              {{ statusCounts[status.value] }}
            </span>
          </button>
        </div>
      </div>

      <!-- Members Table -->
      <div v-if="hasHospital" class="card shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Joined</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="text-center py-4">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                </td>
              </tr>
              <tr v-else-if="members.length === 0">
                <td colspan="6" class="text-center py-4 text-muted">
                  <i class="bi bi-people display-4 d-block mb-2"></i>
                  No members found
                </td>
              </tr>
              <tr v-for="member in members" :key="member.id">
                <td>
                  <span class="username">@{{ member.user.username }}</span>
                </td>
                <td>{{ member.user.name }}</td>
                <td>{{ member.user.email }}</td>
                <td>
                  <span class="status-badge" :class="member.status">
                    {{ formatStatus(member.status) }}
                  </span>
                </td>
                <td>{{ member.joinedAt ? formatDate(member.joinedAt) : '-' }}</td>
                <td class="text-end">
                  <div class="action-buttons">
                    <button 
                      v-if="member.status === 'pending'"
                      class="btn btn-sm btn-success"
                      @click="acceptMember(member)"
                      title="Accept"
                    >
                      <i class="bi bi-check-lg"></i>
                    </button>
                    <button 
                      v-if="member.status === 'accepted'"
                      class="btn btn-sm btn-warning"
                      @click="kickMember(member)"
                      title="Kick"
                    >
                      <i class="bi bi-box-arrow-right"></i>
                    </button>
                    <button 
                      v-if="member.status !== 'blocked'"
                      class="btn btn-sm btn-danger"
                      @click="blockMember(member)"
                      title="Block"
                    >
                      <i class="bi bi-slash-circle"></i>
                    </button>
                    <button 
                      v-if="member.status === 'blocked'"
                      class="btn btn-sm btn-secondary"
                      @click="unblockMember(member)"
                      title="Unblock"
                    >
                      <i class="bi bi-unlock"></i>
                    </button>
                  </div>
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

      <!-- Invite Modal -->
      <div v-if="showInviteModal" class="modal-overlay" @click.self="showInviteModal = false">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-person-plus me-2"></i>Invite Doctor
              </h5>
              <button type="button" class="btn-close" @click="showInviteModal = false"></button>
            </div>
            <form @submit.prevent="inviteMember">
              <div class="modal-body">
                <div class="mb-3">
                  <label for="inviteUsername" class="form-label">Username</label>
                  <div class="search-input-wrapper">
                    <input 
                      type="text" 
                      class="form-control" 
                      id="inviteUsername" 
                      v-model="inviteUsername"
                      @input="searchUsers"
                      placeholder="Enter doctor's username"
                      autocomplete="off"
                    />
                    <div v-if="searchingUsers" class="search-spinner">
                      <div class="spinner-border spinner-border-sm" role="status"></div>
                    </div>
                  </div>
                  <!-- Search Results Dropdown -->
                  <div v-if="userSearchResults.length > 0" class="user-search-results">
                    <div 
                      v-for="user in userSearchResults" 
                      :key="user.id"
                      class="user-result-item"
                      @click="selectUser(user)"
                    >
                      <div class="user-info">
                        <span class="username">@{{ user.username }}</span>
                        <span class="name">{{ user.name }}</span>
                      </div>
                      <span class="email">{{ user.email }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="inviteError" class="alert alert-danger">
                  {{ inviteError }}
                </div>
                <div v-if="inviteSuccess" class="alert alert-success">
                  {{ inviteSuccess }}
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showInviteModal = false">Close</button>
                <button type="submit" class="btn btn-primary" :disabled="inviteLoading || !inviteUsername">
                  <span v-if="inviteLoading" class="spinner-border spinner-border-sm me-2"></span>
                  {{ inviteLoading ? 'Inviting...' : 'Send Invitation' }}
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
  name: 'MemberManagement',
  data() {
    return {
      members: [],
      loading: true,
      hasHospital: true,
      searchQuery: '',
      filterStatus: '',
      statuses: [
        { value: '', label: 'All' },
        { value: 'pending', label: 'Pending' },
        { value: 'accepted', label: 'Active' },
        { value: 'kicked', label: 'Kicked' },
        { value: 'blocked', label: 'Blocked' }
      ],
      statusCounts: {},
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      },
      showInviteModal: false,
      inviteUsername: '',
      inviteLoading: false,
      inviteError: '',
      inviteSuccess: '',
      userSearchResults: [],
      searchingUsers: false,
      searchTimeout: null
    };
  },
  async mounted() {
    await this.loadMembers();
    await this.loadStatusCounts();
  },
  methods: {
    async loadMembers() {
      this.loading = true;
      
      try {
        const token = localStorage.getItem('auth-token');
        const params = new URLSearchParams({
          page: this.pagination.page,
          limit: this.pagination.limit
        });
        
        if (this.filterStatus) {
          params.append('status', this.filterStatus);
        }
        if (this.searchQuery) {
          params.append('search', this.searchQuery);
        }
        
        const response = await axios.get(
          `${orthancApiUrl}api/members?${params.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.members = response.data.members;
          this.pagination = response.data.pagination;
          this.hasHospital = true;
        }
      } catch (error) {
        console.error('Error loading members:', error);
        if (error.response?.status === 404) {
          this.hasHospital = false;
        }
      } finally {
        this.loading = false;
      }
    },
    
    async loadStatusCounts() {
      try {
        const token = localStorage.getItem('auth-token');
        
        // Load counts for each status
        for (const status of ['pending', 'accepted', 'kicked', 'blocked']) {
          const response = await axios.get(
            `${orthancApiUrl}api/members?status=${status}&limit=1`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          if (response.data.success) {
            this.statusCounts[status] = response.data.pagination.total;
          }
        }
      } catch (error) {
        console.error('Error loading status counts:', error);
      }
    },
    
    debouncedSearch() {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      this.searchTimeout = setTimeout(() => {
        this.pagination.page = 1;
        this.loadMembers();
      }, 300);
    },
    
    goToPage(page) {
      this.pagination.page = page;
      this.loadMembers();
    },
    
    async acceptMember(member) {
      try {
        const token = localStorage.getItem('auth-token');
        await axios.put(
          `${orthancApiUrl}api/members/${member.id}/accept`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        await this.loadMembers();
        await this.loadStatusCounts();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to accept member');
      }
    },
    
    async kickMember(member) {
      if (!confirm(`Are you sure you want to kick @${member.user.username}?`)) return;
      
      try {
        const token = localStorage.getItem('auth-token');
        await axios.put(
          `${orthancApiUrl}api/members/${member.id}/kick`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        await this.loadMembers();
        await this.loadStatusCounts();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to kick member');
      }
    },
    
    async blockMember(member) {
      if (!confirm(`Are you sure you want to block @${member.user.username}? They won't be able to join your hospital again.`)) return;
      
      try {
        const token = localStorage.getItem('auth-token');
        await axios.put(
          `${orthancApiUrl}api/members/${member.id}/block`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        await this.loadMembers();
        await this.loadStatusCounts();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to block member');
      }
    },
    
    async unblockMember(member) {
      try {
        const token = localStorage.getItem('auth-token');
        await axios.put(
          `${orthancApiUrl}api/members/${member.id}/unblock`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        await this.loadMembers();
        await this.loadStatusCounts();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to unblock member');
      }
    },
    
    async searchUsers() {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      
      if (!this.inviteUsername || this.inviteUsername.length < 2) {
        this.userSearchResults = [];
        return;
      }
      
      this.searchTimeout = setTimeout(async () => {
        this.searchingUsers = true;
        
        try {
          const token = localStorage.getItem('auth-token');
          const response = await axios.get(
            `${orthancApiUrl}api/members/search-users?username=${encodeURIComponent(this.inviteUsername)}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          if (response.data.success) {
            this.userSearchResults = response.data.users;
          }
        } catch (error) {
          console.error('Error searching users:', error);
        } finally {
          this.searchingUsers = false;
        }
      }, 300);
    },
    
    selectUser(user) {
      this.inviteUsername = user.username;
      this.userSearchResults = [];
    },
    
    async inviteMember() {
      this.inviteLoading = true;
      this.inviteError = '';
      this.inviteSuccess = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.post(
          `${orthancApiUrl}api/members/invite`,
          { username: this.inviteUsername },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.inviteSuccess = 'Invitation sent successfully!';
          this.inviteUsername = '';
          await this.loadMembers();
          await this.loadStatusCounts();
          
          setTimeout(() => {
            this.inviteSuccess = '';
          }, 3000);
        }
      } catch (error) {
        this.inviteError = error.response?.data?.error || 'Failed to send invitation';
      } finally {
        this.inviteLoading = false;
      }
    },
    
    formatStatus(status) {
      const statuses = {
        pending: 'Pending',
        accepted: 'Active',
        kicked: 'Kicked',
        blocked: 'Blocked'
      };
      return statuses[status] || status;
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
.member-management {
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
  gap: 6px;
}

.btn-filter:hover {
  background: #e5e7eb;
}

.btn-filter.active {
  background: #4a90e2;
  border-color: #4a90e2;
  color: white;
}

.count-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 0 6px;
  border-radius: 10px;
  font-size: 0.75rem;
}

.btn-filter.active .count-badge {
  background: rgba(255, 255, 255, 0.3);
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

.username {
  font-weight: 500;
  color: #4a90e2;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.pending {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.accepted {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.kicked {
  background: #f3f4f6;
  color: #4b5563;
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

.search-input-wrapper {
  position: relative;
}

.search-spinner {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
}

.user-search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
}

.user-result-item {
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f3f4f6;
}

.user-result-item:last-child {
  border-bottom: none;
}

.user-result-item:hover {
  background: #f9fafb;
}

.user-result-item .user-info {
  display: flex;
  flex-direction: column;
}

.user-result-item .username {
  font-weight: 500;
  color: #4a90e2;
  font-size: 0.875rem;
}

.user-result-item .name {
  font-size: 0.75rem;
  color: #6b7280;
}

.user-result-item .email {
  font-size: 0.75rem;
  color: #9ca3af;
}

.btn-primary {
  background-color: #4a90e2;
  border-color: #4a90e2;
  border-radius: 8px;
  padding: 10px 20px;
  font-weight: 500;
}

.btn-primary:hover {
  background-color: #357abd;
  border-color: #357abd;
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
  
  .table-responsive {
    font-size: 0.875rem;
  }
}
</style>
