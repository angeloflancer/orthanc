<template>
  <div class="member-management">
    <div class="mm-container">
      <div class="mm-header">
        <h2 class="mm-title">Hospital Members</h2>
        <div class="mm-header-actions">
          <div v-if="hasHospital" class="mm-search-wrap">
            <i class="bi bi-search mm-search-icon"></i>
            <input
              type="text"
              class="mm-search-input"
              placeholder="Search by username, name, or email..."
              v-model="searchQuery"
              @input="debouncedSearch"
            />
          </div>
          <button type="button" class="mm-btn mm-btn-primary" @click="showInviteModal = true">
            <i class="bi bi-person-plus"></i> Invite Doctor
          </button>
        </div>
      </div>

      <!-- No Hospital Warning -->
      <div v-if="!hasHospital && !loading" class="mm-alert mm-alert-warning">
        <i class="bi bi-exclamation-triangle"></i>
        You need to create a hospital first before managing members.
        <router-link to="/hospital-settings" class="mm-alert-link">Create Hospital</router-link>
      </div>

      <!-- Members card (owner Hospital Management style) -->
      <div v-if="hasHospital" class="mm-card">
        <div class="mm-members-section">
          <!-- Status filter pills -->
          <div class="mm-filter-pills">
            <button
              v-for="opt in filterOptions"
              :key="opt.value"
              type="button"
              class="mm-pill"
              :class="{ active: filterStatus === opt.value }"
              @click="setFilter(opt.value)"
            >
              {{ opt.label }}
              <span v-if="opt.value && statusCounts[opt.value]" class="mm-pill-count">{{ statusCounts[opt.value] }}</span>
            </button>
          </div>
          <div v-if="loading" class="mm-members-loading">
            <div class="mm-spinner" role="status"></div>
          </div>
          <div v-else-if="members.length === 0" class="mm-members-empty">
            No members yet. Invite a doctor by username.
          </div>
          <div v-else class="mm-members-wrap">
            <table class="mm-members-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th class="mm-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in members" :key="member.id">
                  <td>{{ member.user ? member.user.name : '—' }}</td>
                  <td>@{{ member.user ? member.user.username : '—' }}</td>
                  <td class="mm-cell-email">{{ member.user ? member.user.email : '—' }}</td>
                  <td>
                    <span class="mm-badge mm-badge-status" :class="'mm-status-' + member.status">
                      {{ statusLabel(member.status) }}
                    </span>
                  </td>
                  <td class="mm-col-actions">
                    <template v-if="member.status === 'pending'">
                      <button type="button" class="mm-btn mm-btn-row mm-btn-accept" title="Accept" @click="acceptMember(member)">Accept</button>
                      <button type="button" class="mm-btn mm-btn-row mm-btn-kick" title="Kick" @click="confirmAction(member, 'kick')">Kick</button>
                      <button type="button" class="mm-btn mm-btn-row mm-btn-block" title="Block" @click="confirmAction(member, 'block')">Block</button>
                    </template>
                    <template v-else-if="member.status === 'accepted' || member.status === 'pending_invitation'">
                      <button type="button" class="mm-btn mm-btn-row mm-btn-kick" title="Kick" @click="confirmAction(member, 'kick')">Kick</button>
                      <button type="button" class="mm-btn mm-btn-row mm-btn-block" title="Block" @click="confirmAction(member, 'block')">Block</button>
                    </template>
                    <template v-else-if="member.status === 'blocked'">
                      <button type="button" class="mm-btn mm-btn-row mm-btn-unblock" title="Unblock" @click="unblockMember(member)">Unblock</button>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="pagination.pages > 1" class="mm-members-pagination">
              <button type="button" class="mm-pagination-btn" :disabled="pagination.page <= 1" @click="goToPage(pagination.page - 1)">
                <i class="bi bi-chevron-left"></i>
              </button>
              <span class="mm-page-info">Page <strong>{{ pagination.page }}</strong> of <strong>{{ pagination.pages }}</strong></span>
              <button type="button" class="mm-pagination-btn" :disabled="pagination.page >= pagination.pages" @click="goToPage(pagination.page + 1)">
                <i class="bi bi-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Confirm action modal (kick / block) -->
      <div v-if="showConfirmModal" class="mm-modal-overlay" @click.self="showConfirmModal = false">
        <div class="mm-modal-dialog">
          <div class="mm-modal-content">
            <div class="mm-modal-header">
              <h5 class="mm-modal-title">{{ confirmTitle }}</h5>
              <button type="button" class="mm-modal-close" @click="showConfirmModal = false" aria-label="Close">&times;</button>
            </div>
            <div class="mm-modal-body">
              <p class="mm-modal-message">{{ confirmMessage }}</p>
            </div>
            <div class="mm-modal-footer">
              <button type="button" class="mm-btn mm-btn-ghost" @click="showConfirmModal = false">Cancel</button>
              <button type="button" class="mm-btn mm-btn-danger" :disabled="confirming" @click="executeConfirm">
                <span v-if="confirming" class="mm-spinner mm-spinner-sm"></span>
                {{ confirmButtonText }}
              </button>
            </div>
          </div>
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
      statusCounts: {},
      filterOptions: [
        { value: '', label: 'All' },
        { value: 'pending', label: 'Pending Request' },
        { value: 'pending_invitation', label: 'Pending Invitation' },
        { value: 'accepted', label: 'Active' },
        { value: 'kicked', label: 'Kicked' },
        { value: 'blocked', label: 'Blocked' }
      ],
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
      searchTimeout: null,
      showConfirmModal: false,
      confirmTitle: '',
      confirmMessage: '',
      confirmButtonText: '',
      confirming: false,
      confirmMember: null,
      confirmActionType: '',
      searchTimeoutMembers: null
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
      if (!this.hasHospital) return;
      try {
        const token = localStorage.getItem('auth-token');
        for (const status of ['pending', 'pending_invitation', 'accepted', 'kicked', 'blocked']) {
          const params = new URLSearchParams({ status, limit: 1 });
          const response = await axios.get(
            `${orthancApiUrl}api/members?${params.toString()}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (response.data.success) {
            this.statusCounts[status] = response.data.pagination.total;
          }
        }
      } catch (error) {
        console.error('Error loading status counts:', error);
      }
    },
    
    setFilter(value) {
      this.filterStatus = value;
      this.pagination.page = 1;
      this.loadMembers();
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
    
    confirmAction(member, actionType) {
      this.confirmMember = member;
      this.confirmActionType = actionType;
      const name = member.user ? `@${member.user.username}` : 'this member';
      if (actionType === 'kick') {
        this.confirmTitle = 'Kick member';
        this.confirmMessage = `Are you sure you want to kick ${name}?`;
        this.confirmButtonText = 'Kick';
      } else if (actionType === 'block') {
        this.confirmTitle = 'Block member';
        this.confirmMessage = `Are you sure you want to block ${name}? They won't be able to join your hospital again.`;
        this.confirmButtonText = 'Block';
      }
      this.showConfirmModal = true;
    },
    
    async executeConfirm() {
      if (!this.confirmMember) return;
      this.confirming = true;
      try {
        if (this.confirmActionType === 'kick') {
          await this.kickMember(this.confirmMember);
        } else if (this.confirmActionType === 'block') {
          await this.blockMember(this.confirmMember);
        }
        this.showConfirmModal = false;
        this.confirmMember = null;
        this.confirmActionType = '';
      } finally {
        this.confirming = false;
      }
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
    
    statusLabel(status) {
      const labels = {
        accepted: 'Member',
        pending: 'Pending',
        pending_invitation: 'Invited',
        kicked: 'Kicked',
        blocked: 'Blocked',
        cancelled: 'Cancelled'
      };
      return labels[status] || status;
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
  padding: 24px;
}

.mm-container {
  max-width: 1200px;
  margin: 0 auto;
}

.mm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.mm-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.mm-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.mm-search-wrap {
  position: relative;
  max-width: 320px;
}

.mm-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 14px;
}

.mm-search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  font-size: 13px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #374151;
}

.mm-search-input:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
}

.mm-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}

.mm-btn-primary {
  background: #4a90e2;
  color: #fff;
}

.mm-btn-primary:hover:not(:disabled) {
  background: #357abd;
}

.mm-btn-ghost {
  background: transparent;
  color: #64748b;
}

.mm-btn-ghost:hover {
  background: #f1f5f9;
}

.mm-btn-danger {
  background: #dc2626;
  color: #fff;
}

.mm-btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.mm-btn-danger:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.mm-alert {
  padding: 14px 18px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.mm-alert-warning {
  background: #fef3c7;
  color: #92400e;
}

.mm-alert-link {
  color: #b45309;
  font-weight: 500;
  margin-left: 4px;
}

/* Card: same as Hospital Management */
.mm-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.mm-members-section {
  padding: 20px 24px 24px;
}

.mm-members-header {
  margin-bottom: 14px;
}

.mm-section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  margin: 0;
}

/* Status filter pills – match current UI */
.mm-filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.mm-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.mm-pill:hover {
  background: #e2e8f0;
  border-color: #cbd5e1;
  color: #334155;
}

.mm-pill.active {
  background: #4a90e2;
  border-color: #4a90e2;
  color: #fff;
}

.mm-pill.active:hover {
  background: #357abd;
  border-color: #357abd;
  color: #fff;
}

.mm-pill-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 0 5px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.08);
  color: inherit;
}

.mm-pill.active .mm-pill-count {
  background: rgba(255, 255, 255, 0.25);
}

.mm-members-loading {
  padding: 32px;
  text-align: center;
}

.mm-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #4a90e2;
  border-radius: 50%;
  animation: mm-spin 0.8s linear infinite;
  margin: 0 auto;
}

.mm-spinner-sm {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: mm-spin 0.8s linear infinite;
  vertical-align: middle;
}

@keyframes mm-spin {
  to { transform: rotate(360deg); }
}

.mm-members-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px dashed #e2e8f0;
}

.mm-members-wrap {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.mm-members-table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}

.mm-members-table th {
  text-align: left;
  padding: 12px 14px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.mm-members-table td {
  text-align: left;
  padding: 12px 14px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  vertical-align: middle;
}

.mm-members-table tbody tr:last-child td {
  border-bottom: none;
}

.mm-members-table tbody tr:hover td {
  background: #fafbfc;
}

.mm-cell-email {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #6b7280;
}

.mm-col-actions {
  white-space: nowrap;
  max-width: 75px;
  text-align: center !important;
}

.mm-col-actions .mm-btn {
  margin-left: 6px;
}

.mm-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
  flex-shrink: 0;
}

.mm-badge-status {
  display: inline-block;
}

.mm-status-accepted {
  background: #dcfce7 !important;
  color: #15803d !important;
}

.mm-status-pending,
.mm-status-pending_invitation {
  background: #fef3c7 !important;
  color: #92400e !important;
}

.mm-status-blocked {
  background: #fee2e2 !important;
  color: #dc2626 !important;
}

.mm-status-kicked {
  background: #f3f4f6 !important;
  color: #6b7280 !important;
}

.mm-btn-row {
  padding: 4px 10px;
  font-size: 12px;
}

.mm-btn-accept {
  background: #dcfce7;
  color: #15803d;
}

.mm-btn-accept:hover:not(:disabled) {
  background: #bbf7d0;
}

.mm-btn-kick {
  background: #fef3c7;
  color: #92400e;
}

.mm-btn-kick:hover:not(:disabled) {
  background: #fde68a;
}

.mm-btn-block {
  background: #fee2e2;
  color: #dc2626;
}

.mm-btn-block:hover:not(:disabled) {
  background: #fecaca;
}

.mm-btn-unblock {
  background: #dcfce7;
  color: #15803d;
}

.mm-btn-unblock:hover:not(:disabled) {
  background: #bbf7d0;
}

.mm-members-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  background: #fafbfc;
}

.mm-pagination-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
}

.mm-pagination-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.mm-pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mm-page-info {
  font-size: 13px;
  color: #64748b;
}

/* Confirm modal */
.mm-modal-overlay {
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

.mm-modal-dialog {
  width: 100%;
  max-width: 420px;
}

.mm-modal-content {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.mm-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.mm-modal-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #1e293b;
}

.mm-modal-close {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: #64748b;
  cursor: pointer;
  padding: 0;
}

.mm-modal-close:hover {
  color: #1e293b;
}

.mm-modal-body {
  padding: 20px;
}

.mm-modal-message {
  margin: 0;
  font-size: 14px;
  color: #475569;
  line-height: 1.5;
}

.mm-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  background: #fafbfc;
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
  .mm-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .mm-search-wrap {
    max-width: 100%;
    width: 100%;
  }
  
  .mm-members-table {
    font-size: 12px;
  }
}
</style>
