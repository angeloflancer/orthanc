<template>
  <div class="hospital-management">
    <div class="hm-container">
      <header class="hm-header">
        <h1 class="hm-title">Hospital Management</h1>
        <p class="hm-subtitle">Manage hospitals, members, and subscriptions.</p>
      </header>

      <div v-if="loading" class="hm-loading">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>

      <div v-else-if="hospitals.length === 0" class="hm-empty">
        <div class="hm-empty-icon">
          <i class="bi bi-building"></i>
        </div>
        <h3>No hospitals yet</h3>
        <p>Hospitals are created by admins. Assign an admin in User Management or wait for an admin to create a hospital.</p>
      </div>

      <div v-else>
        <div class="hm-cards">
        <section
          v-for="hospital in hospitals"
          :key="hospital.id"
          class="hm-card"
        >
          <div class="hm-card-head">
            <div class="hm-card-title-row">
              <h2 class="hm-card-name">{{ hospital.name }}</h2>
              <span class="hm-card-id">{{ hospital.hospitalId }}</span>
              <span
                class="hm-badge hm-badge-sub"
                :class="subClass(hospital)"
              >
                {{ subscriptionLabel(hospital) }}
              </span>
            </div>
            <div class="hm-card-meta">
              <span class="hm-meta-item">
                <i class="bi bi-people"></i>
                <strong>{{ hospital.memberCount || 0 }}</strong> members
                <template v-if="hospital.pendingCount > 0">
                  · <span class="text-muted">{{ hospital.pendingCount }} pending</span>
                </template>
              </span>
              <span v-if="hospital.admin" class="hm-meta-item hm-meta-admin">
                Admin: {{ hospital.admin.name }} <span class="hm-meta-detail">@{{ hospital.admin.username }}</span>
              </span>
            </div>
            <p v-if="hospital.address" class="hm-card-address">{{ hospital.address }}</p>
          </div>

          <div class="hm-card-body">
            <div class="hm-members-section">
              <div class="hm-members-header">
                <h3 class="hm-section-title">Members</h3>
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  @click.stop="openAddDoctor(hospital)"
                >
                  <i class="bi bi-person-plus me-1"></i>Add doctor
                </button>
              </div>
              <div v-if="membersLoading[hospital.id]" class="hm-members-loading">
                <div class="spinner-border spinner-border-sm" role="status"></div>
              </div>
              <div v-else-if="!membersByHospital[hospital.id] || membersByHospital[hospital.id].length === 0" class="hm-members-empty">
                No members yet. Add a doctor by username.
              </div>
              <div v-else>
                <table class="hm-members-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th class="hm-col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="m in membersByHospital[hospital.id]" :key="m.id">
                      <td>{{ m.user ? m.user.name : '—' }}</td>
                      <td>@{{ m.user ? m.user.username : '—' }}</td>
                      <td class="hm-cell-email">{{ m.user ? m.user.email : '—' }}</td>
                      <td>
                        <span class="hm-badge hm-badge-status" :class="'hm-status-' + m.status">
                          {{ statusLabel(m.status) }}
                        </span>
                      </td>
                      <td class="hm-col-actions">
                        <template v-if="m.status === 'accepted' || m.status === 'pending' || m.status === 'pending_invitation'">
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-danger me-1"
                            title="Kick"
                            @click="confirmAction(hospital, m, 'kick')"
                          >
                            Kick
                          </button>
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            title="Block"
                            @click="confirmAction(hospital, m, 'block')"
                          >
                            Block
                          </button>
                        </template>
                        <template v-else-if="m.status === 'blocked'">
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-secondary"
                            title="Unblock"
                            @click="confirmAction(hospital, m, 'unblock')"
                          >
                            Unblock
                          </button>
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="membersPagination[hospital.id] && membersPagination[hospital.id].pages > 1" class="hm-members-pagination">
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    :disabled="!membersPagination[hospital.id] || membersPagination[hospital.id].page <= 1"
                    @click="goToMembersPage(hospital.id, (membersPagination[hospital.id]?.page || 1) - 1)"
                  >
                    <i class="bi bi-chevron-left"></i>
                  </button>
                  <span class="hm-page-info">Page {{ membersPagination[hospital.id]?.page || 1 }} of {{ membersPagination[hospital.id]?.pages || 1 }}</span>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    :disabled="!membersPagination[hospital.id] || membersPagination[hospital.id].page >= membersPagination[hospital.id].pages"
                    @click="goToMembersPage(hospital.id, (membersPagination[hospital.id]?.page || 1) + 1)"
                  >
                    <i class="bi bi-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>
            <div class="hm-card-actions">
              <button type="button" class="btn btn-primary" @click.stop="openSubscribe(hospital)">
                <i class="bi bi-calendar-check me-1"></i>Subscribe / Extend
              </button>
              <button
                v-if="hospital.admin && hospital.subscription && hospital.subscription.isActive"
                type="button"
                class="btn btn-outline-danger"
                @click.stop="expireHospital(hospital)"
              >
                <i class="bi bi-x-circle me-1"></i>Expire subscription
              </button>
              <button type="button" class="btn btn-outline-secondary" @click.stop="openChangeAdmin(hospital)">
                <i class="bi bi-person-gear me-1"></i>Change admin
              </button>
            </div>
          </div>
        </section>
        </div>
        <div v-if="!loading && pagination.pages > 1" class="hm-pagination-section">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="pagination.page <= 1"
            @click="goToHospitalsPage(pagination.page - 1)"
          >
            <i class="bi bi-chevron-left"></i>
          </button>
          <span class="hm-page-info">Page {{ pagination.page }} of {{ pagination.pages }}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="pagination.page >= pagination.pages"
            @click="goToHospitalsPage(pagination.page + 1)"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>

      <!-- Subscribe modal -->
      <div v-if="showSubscribeModal" class="hm-modal-overlay" @click.self="showSubscribeModal = false">
        <div class="hm-modal">
          <div class="hm-modal-header">
            <h3>Subscribe / Extend</h3>
            <button type="button" class="btn-close" @click="showSubscribeModal = false" aria-label="Close"></button>
          </div>
          <div class="hm-modal-body">
            <p class="hm-modal-hospital-name">{{ selectedHospital ? selectedHospital.name : '' }}</p>
            <div class="hm-plan-options">
              <div
                v-for="plan in subscriptionPlans"
                :key="plan.value"
                class="form-check"
              >
                <input
                  :id="`plan-${plan.value}`"
                  v-model="selectedPlan"
                  type="radio"
                  :value="plan.value"
                  class="form-check-input"
                />
                <label :for="`plan-${plan.value}`" class="form-check-label">
                  {{ plan.name }} – {{ plan.description }}
                </label>
              </div>
            </div>
          </div>
          <div class="hm-modal-footer">
            <button type="button" class="btn btn-secondary" @click="showSubscribeModal = false">Cancel</button>
            <button type="button" class="btn btn-primary" :disabled="!selectedPlan || applyingPlan" @click="applyPlan">
              <span v-if="applyingPlan" class="spinner-border spinner-border-sm me-2"></span>
              Apply
            </button>
          </div>
        </div>
      </div>

      <!-- Change admin modal -->
      <div v-if="showChangeAdminModal" class="hm-modal-overlay" @click.self="showChangeAdminModal = false">
        <div class="hm-modal">
          <div class="hm-modal-header">
            <h3>Change admin</h3>
            <button type="button" class="btn-close" @click="showChangeAdminModal = false" aria-label="Close"></button>
          </div>
          <div class="hm-modal-body">
            <p class="text-muted small mb-3">Select a doctor to assign as admin of {{ selectedHospital ? selectedHospital.name : '' }}.</p>
            <div v-if="doctorsLoading" class="text-center py-3">
              <div class="spinner-border spinner-border-sm" role="status"></div>
            </div>
            <div v-else class="hm-doctor-list">
              <div
                v-for="doc in doctors"
                :key="doc.id"
                class="form-check py-2 border-bottom"
              >
                <input
                  :id="`doctor-${doc.id}`"
                  v-model="selectedDoctorId"
                  type="radio"
                  :value="doc.id"
                  class="form-check-input"
                />
                <label :for="`doctor-${doc.id}`" class="form-check-label">
                  {{ doc.name }} @{{ doc.username }} ({{ doc.email }})
                </label>
              </div>
              <p v-if="doctors.length === 0" class="text-muted small mb-0">No doctors found.</p>
            </div>
          </div>
          <div class="hm-modal-footer">
            <button type="button" class="btn btn-secondary" @click="showChangeAdminModal = false">Cancel</button>
            <button type="button" class="btn btn-primary" :disabled="!selectedDoctorId || changingAdmin" @click="confirmChangeAdmin">
              <span v-if="changingAdmin" class="spinner-border spinner-border-sm me-2"></span>
              Assign admin
            </button>
          </div>
        </div>
      </div>

      <!-- Add doctor modal -->
      <div v-if="showAddDoctorModal" class="hm-modal-overlay" @click.self="showAddDoctorModal = false">
        <div class="hm-modal hm-modal-sm">
          <div class="hm-modal-header">
            <h3>Add doctor</h3>
            <button type="button" class="btn-close" @click="showAddDoctorModal = false" aria-label="Close"></button>
          </div>
          <div class="hm-modal-body">
            <p class="text-muted small mb-2">Invite a doctor to {{ selectedHospital ? selectedHospital.name : '' }} by username.</p>
            <input
              v-model="inviteUsername"
              type="text"
              class="form-control"
              placeholder="Username"
              @keydown.enter="sendInvite"
            />
            <p v-if="inviteError" class="text-danger small mt-2 mb-0">{{ inviteError }}</p>
          </div>
          <div class="hm-modal-footer">
            <button type="button" class="btn btn-secondary" @click="showAddDoctorModal = false">Cancel</button>
            <button type="button" class="btn btn-primary" :disabled="!inviteUsername.trim() || inviting" @click="sendInvite">
              <span v-if="inviting" class="spinner-border spinner-border-sm me-2"></span>
              Send invitation
            </button>
          </div>
        </div>
      </div>

      <!-- Confirm action modal (kick / block / unblock) -->
      <div v-if="showConfirmModal" class="hm-modal-overlay" @click.self="showConfirmModal = false">
        <div class="hm-modal hm-modal-sm">
          <div class="hm-modal-header">
            <h3>{{ confirmTitle }}</h3>
            <button type="button" class="btn-close" @click="showConfirmModal = false" aria-label="Close"></button>
          </div>
          <div class="hm-modal-body">
            <p>{{ confirmMessage }}</p>
          </div>
          <div class="hm-modal-footer">
            <button type="button" class="btn btn-secondary" @click="showConfirmModal = false">Cancel</button>
            <button type="button" class="btn btn-danger" :disabled="confirming" @click="executeConfirm">
              <span v-if="confirming" class="spinner-border spinner-border-sm me-2"></span>
              {{ confirmButtonText }}
            </button>
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
  name: 'HospitalManagement',
  data() {
    return {
      hospitals: [],
      loading: true,
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      membersByHospital: {},
      membersPagination: {},
      membersLoading: {},
      showSubscribeModal: false,
      showChangeAdminModal: false,
      showAddDoctorModal: false,
      showConfirmModal: false,
      selectedHospital: null,
      selectedPlan: null,
      selectedDoctorId: null,
      doctors: [],
      doctorsLoading: false,
      applyingPlan: false,
      changingAdmin: false,
      inviteUsername: '',
      inviteError: '',
      inviting: false,
      confirmActionType: null,
      confirmMember: null,
      confirming: false,
      subscriptionPlans: [
        { value: 'monthly', name: 'Monthly', description: '30 days' },
        { value: 'yearly', name: 'Yearly', description: '365 days' },
        { value: 'forever', name: 'Forever', description: 'Unlimited' }
      ]
    };
  },
  mounted() {
    this.loadHospitals();
  },
  methods: {
    getToken() {
      return localStorage.getItem('auth-token');
    },
    async loadHospitals() {
      this.loading = true;
      try {
        const response = await axios.get(`${orthancApiUrl}api/hospital/all`, {
          headers: { Authorization: `Bearer ${this.getToken()}` },
          params: { page: this.pagination.page, limit: this.pagination.limit }
        });
        if (response.data.success) {
          this.hospitals = response.data.hospitals || [];
          if (response.data.pagination) {
            this.pagination = { ...this.pagination, ...response.data.pagination };
          }
          // Load members for each hospital on the current page (cards are always expanded)
          this.hospitals.forEach(h => this.loadMembers(h.id, 1));
        }
      } catch (error) {
        if (error.response?.status === 403) {
          this.$router.push('/');
        } else {
          console.error('Load hospitals error:', error);
          this.toast('Failed to load hospitals', 'error');
        }
      } finally {
        this.loading = false;
      }
    },
    goToHospitalsPage(page) {
      if (page < 1 || page > this.pagination.pages) return;
      this.pagination.page = page;
      this.loadHospitals();
    },
    async loadMembers(hospitalId, page = 1) {
      this.membersLoading[hospitalId] = true;
      try {
        const response = await axios.get(`${orthancApiUrl}api/hospital/${hospitalId}/members`, {
          headers: { Authorization: `Bearer ${this.getToken()}` },
          params: { page, limit: 10 }
        });
        if (response.data.success) {
          this.membersByHospital[hospitalId] = response.data.members || [];
          if (response.data.pagination) {
            this.membersPagination = { ...this.membersPagination, [hospitalId]: { ...response.data.pagination } };
          }
        }
      } catch (error) {
        console.error('Load members error:', error);
        this.toast('Failed to load members', 'error');
        this.membersByHospital[hospitalId] = [];
      } finally {
        this.membersLoading[hospitalId] = false;
      }
    },
    goToMembersPage(hospitalId, page) {
      const pag = this.membersPagination[hospitalId];
      if (!pag || page < 1 || page > pag.pages) return;
      this.loadMembers(hospitalId, page);
    },
    subscriptionLabel(hospital) {
      if (!hospital.subscription) return 'No plan';
      if (hospital.subscription.planType === 'forever') return 'Forever';
      if (hospital.subscription.isActive) return `${hospital.subscription.planType === 'monthly' ? 'Monthly' : 'Yearly'}`;
      return 'Expired';
    },
    subClass(hospital) {
      if (!hospital.subscription || !hospital.subscription.isActive) return 'hm-badge-expired';
      return 'hm-badge-active';
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
    },
    toast(message, type = 'info') {
      const bus = this.messageBus || this.$messageBus;
      if (bus && typeof bus.emit === 'function') {
        if (type === 'success') bus.emit('show-success-toast', message);
        else if (type === 'error') bus.emit('show-error-toast', message);
        else bus.emit('show-toast', message);
      } else {
        alert(message);
      }
    },
    openSubscribe(hospital) {
      this.selectedHospital = hospital;
      this.selectedPlan = hospital.subscription?.planType || 'monthly';
      this.showSubscribeModal = true;
    },
    async applyPlan() {
      if (!this.selectedHospital || !this.selectedPlan) return;
      this.applyingPlan = true;
      try {
        await axios.post(
          `${orthancApiUrl}api/subscriptions/${this.selectedHospital.id}`,
          { planType: this.selectedPlan },
          { headers: { Authorization: `Bearer ${this.getToken()}` } }
        );
        this.showSubscribeModal = false;
        this.toast('Subscription updated', 'success');
        await this.loadHospitals();
      } catch (error) {
        this.toast(error.response?.data?.error || 'Failed to apply plan', 'error');
      } finally {
        this.applyingPlan = false;
      }
    },
    async expireHospital(hospital) {
      if (!hospital.admin || !confirm(`Expire subscription for ${hospital.name}?`)) return;
      try {
        await axios.post(
          `${orthancApiUrl}api/users/${hospital.admin.id}/expire-hospital`,
          {},
          { headers: { Authorization: `Bearer ${this.getToken()}` } }
        );
        this.toast('Subscription expired', 'success');
        await this.loadHospitals();
      } catch (error) {
        this.toast(error.response?.data?.error || 'Failed to expire hospital', 'error');
      }
    },
    async openChangeAdmin(hospital) {
      this.selectedHospital = hospital;
      this.selectedDoctorId = null;
      this.showChangeAdminModal = true;
      this.doctorsLoading = true;
      try {
        const response = await axios.get(`${orthancApiUrl}api/users?limit=200`, {
          headers: { Authorization: `Bearer ${this.getToken()}` } }
        );
        if (response.data.success) {
          this.doctors = response.data.users || [];
        }
      } finally {
        this.doctorsLoading = false;
      }
    },
    async confirmChangeAdmin() {
      if (!this.selectedHospital || !this.selectedDoctorId) return;
      this.changingAdmin = true;
      try {
        await axios.put(
          `${orthancApiUrl}api/hospital/${this.selectedHospital.id}/admin`,
          { userId: this.selectedDoctorId },
          { headers: { Authorization: `Bearer ${this.getToken()}` } }
        );
        this.showChangeAdminModal = false;
        this.toast('Admin updated', 'success');
        await this.loadHospitals();
      } catch (error) {
        this.toast(error.response?.data?.error || 'Failed to change admin', 'error');
      } finally {
        this.changingAdmin = false;
      }
    },
    openAddDoctor(hospital) {
      this.selectedHospital = hospital;
      this.inviteUsername = '';
      this.inviteError = '';
      this.showAddDoctorModal = true;
    },
    async sendInvite() {
      if (!this.selectedHospital || !this.inviteUsername.trim()) return;
      this.inviteError = '';
      this.inviting = true;
      try {
        await axios.post(
          `${orthancApiUrl}api/hospital/${this.selectedHospital.id}/members/invite`,
          { username: this.inviteUsername.trim() },
          { headers: { Authorization: `Bearer ${this.getToken()}` } }
        );
        this.showAddDoctorModal = false;
        this.toast('Invitation sent', 'success');
        await this.loadMembers(this.selectedHospital.id, 1);
        await this.loadHospitals();
      } catch (error) {
        this.inviteError = error.response?.data?.error || 'Failed to send invitation';
      } finally {
        this.inviting = false;
      }
    },
    confirmAction(hospital, member, action) {
      this.selectedHospital = hospital;
      this.confirmMember = member;
      this.confirmActionType = action;
      const name = member.user ? member.user.name || member.user.username : 'this user';
      if (action === 'kick') {
        this.confirmTitle = 'Kick member';
        this.confirmMessage = `Kick ${name} from ${hospital.name}? They will need to request or be re-invited to join again.`;
        this.confirmButtonText = 'Kick';
      } else if (action === 'block') {
        this.confirmTitle = 'Block member';
        this.confirmMessage = `Block ${name} from ${hospital.name}? They will be unable to use the platform until unblocked.`;
        this.confirmButtonText = 'Block';
      } else {
        this.confirmTitle = 'Unblock member';
        this.confirmMessage = `Unblock ${name}? They will remain kicked from the hospital but can use the platform again.`;
        this.confirmButtonText = 'Unblock';
      }
      this.showConfirmModal = true;
    },
    async executeConfirm() {
      if (!this.selectedHospital || !this.confirmMember || !this.confirmActionType) return;
      this.confirming = true;
      try {
        const base = `${orthancApiUrl}api/hospital/${this.selectedHospital.id}/members/${this.confirmMember.id}`;
        if (this.confirmActionType === 'kick') {
          await axios.put(base + '/kick', {}, { headers: { Authorization: `Bearer ${this.getToken()}` } });
          this.toast('Member kicked', 'success');
        } else if (this.confirmActionType === 'block') {
          await axios.put(base + '/block', {}, { headers: { Authorization: `Bearer ${this.getToken()}` } });
          this.toast('Member blocked', 'success');
        } else {
          await axios.put(base + '/unblock', {}, { headers: { Authorization: `Bearer ${this.getToken()}` } });
          this.toast('Member unblocked', 'success');
        }
        this.showConfirmModal = false;
        await this.loadMembers(this.selectedHospital.id, 1);
        await this.loadHospitals();
      } catch (error) {
        this.toast(error.response?.data?.error || 'Action failed', 'error');
      } finally {
        this.confirming = false;
      }
    }
  }
};
</script>

<style scoped>
.hospital-management {
  padding: 0 8px 24px;
}

.hm-container {
  max-width: 900px;
  margin: 0 auto;
}

.hm-header {
  margin-bottom: 28px;
}

.hm-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--bs-body-color, #111);
  margin: 0 0 4px 0;
}

.hm-subtitle {
  color: var(--bs-secondary-color, #6b7280);
  font-size: 0.9375rem;
  margin: 0;
}

.hm-loading {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.hm-empty {
  text-align: center;
  padding: 48px 24px;
  background: var(--bs-body-bg, #fff);
  border-radius: 12px;
  border: 1px solid var(--bs-border-color, #e5e7eb);
}

.hm-empty-icon {
  font-size: 2.5rem;
  color: var(--bs-secondary-color, #9ca3af);
  margin-bottom: 12px;
}

.hm-empty h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.hm-empty p {
  color: var(--bs-secondary-color);
  font-size: 0.9375rem;
  margin: 0;
}

.hm-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hm-card {
  background: var(--bs-body-bg, #fff);
  border: 1px solid var(--bs-border-color, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.hm-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.hm-card-head {
  padding: 18px 20px;
}

.hm-card-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}

.hm-card-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: var(--bs-body-color, #111);
}

.hm-card-id {
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
  background: var(--bs-light, #f3f4f6);
  padding: 2px 8px;
  border-radius: 6px;
}

.hm-badge {
  font-size: 0.7rem;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.hm-badge-active {
  background: #d1fae5;
  color: #065f46;
}

.hm-badge-expired {
  background: #fee2e2;
  color: #991b1b;
}

.hm-badge-status {
  background: #f3f4f6;
  color: #374151;
}

.hm-status-accepted { background: #d1fae5; color: #065f46; }
.hm-status-pending,
.hm-status-pending_invitation { background: #fef3c7; color: #92400e; }
.hm-status-blocked { background: #fee2e2; color: #991b1b; }
.hm-status-kicked { background: #f3f4f6; color: #6b7280; }

.hm-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.875rem;
  color: var(--bs-secondary-color);
}

.hm-meta-item i {
  margin-right: 4px;
}

.hm-meta-admin .hm-meta-detail {
  color: var(--bs-secondary-color);
  font-weight: normal;
}

.hm-card-address {
  font-size: 0.8125rem;
  color: var(--bs-secondary-color);
  margin: 6px 0 0 0;
}


.hm-card-body {
  border-top: 1px solid var(--bs-border-color, #e5e7eb);
  padding: 20px;
  background: var(--bs-body-bg, #fafafa);
}

.hm-members-section {
  margin-bottom: 20px;
}

.hm-members-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.hm-section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0;
  color: var(--bs-body-color);
}

.hm-members-loading,
.hm-members-empty {
  padding: 16px;
  text-align: center;
  color: var(--bs-secondary-color);
  font-size: 0.875rem;
  background: var(--bs-body-bg, #fff);
  border-radius: 8px;
  border: 1px dashed var(--bs-border-color);
}

.hm-members-table-wrap {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid var(--bs-border-color);
  background: var(--bs-body-bg, #fff);
}

.hm-pagination-section,
.hm-members-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  margin-top: 8px;
}

.hm-members-pagination {
  padding: 12px 0 0;
}

.hm-page-info {
  font-size: 0.875rem;
  color: var(--bs-secondary-color);
}

.hm-members-table {
  width: 100%;
  font-size: 0.875rem;
  border-collapse: collapse;
}

.hm-members-table th,
.hm-members-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--bs-border-color-translucent, #eee);
}

.hm-members-table th {
  font-weight: 600;
  color: var(--bs-secondary-color);
  background: var(--bs-tertiary-bg, #f9fafb);
}

.hm-members-table tbody tr:last-child td {
  border-bottom: none;
}

.hm-cell-email {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hm-col-actions {
  white-space: nowrap;
}

.hm-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--bs-border-color-translucent, #eee);
}

/* Modals */
.hm-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 20px;
}

.hm-modal {
  background: var(--bs-body-bg, #fff);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  max-width: 440px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.hm-modal-sm {
  max-width: 380px;
}

.hm-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--bs-border-color, #e5e7eb);
}

.hm-modal-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.hm-modal-body {
  padding: 20px;
  overflow-y: auto;
}

.hm-modal-hospital-name {
  font-weight: 500;
  margin-bottom: 14px;
}

.hm-plan-options .form-check {
  padding-left: 1.5rem;
  margin-bottom: 8px;
}

.hm-doctor-list {
  max-height: 280px;
  overflow-y: auto;
}

.hm-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--bs-border-color, #e5e7eb);
  background: var(--bs-tertiary-bg, #f9fafb);
}
</style>
