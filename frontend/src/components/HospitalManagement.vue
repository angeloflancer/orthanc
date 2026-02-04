<template>
  <div class="hm-page">
    <div class="hm-container">
      <header class="hm-header">
        <div class="hm-header-row">
          <div class="hm-header-text">
            <h1 class="hm-title">Hospital Management</h1>
            <p class="hm-subtitle">Manage hospitals, members, and subscriptions.</p>
          </div>
          <button
            v-if="!loading && hospitals.length === 0"
            type="button"
            class="hm-btn hm-btn-primary"
            @click="openCreateHospital"
          >
            <i class="bi bi-plus-lg"></i> Create hospital
          </button>
        </div>
      </header>

      <div v-if="loading" class="hm-loading">
        <div class="hm-loading-spinner"></div>
        <p class="hm-loading-text">Loading hospitals...</p>
      </div>

      <div v-else-if="hospitals.length === 0" class="hm-empty">
        <div class="hm-empty-icon"><i class="bi bi-building"></i></div>
        <h3 class="hm-empty-title">No hospitals yet</h3>
        <p class="hm-empty-text">Create the first hospital and assign a user as its admin (they must be a registered doctor).</p>
        <button type="button" class="hm-btn hm-btn-primary" @click="openCreateHospital">
          <i class="bi bi-plus-lg"></i> Create hospital
        </button>
      </div>

      <div v-else>
        <div class="hm-cards">
          <section
            v-for="hospital in hospitals"
            :key="hospital.id"
            class="hm-card"
          >
            <div class="hm-card-head">
              <div class="hm-card-hero">
                <div class="hm-card-icon">
                  <i class="bi bi-building"></i>
                </div>
                <div class="hm-card-titles">
                  <h2 class="hm-card-name">{{ hospital.name }}</h2>
                  <span class="hm-card-id">{{ hospital.hospitalId }}</span>
                </div>
                <span class="hm-badge hm-badge-sub" :class="subClass(hospital)">
                  {{ subscriptionLabel(hospital) }}
                </span>
              </div>
              <div class="hm-card-meta">
                <span class="hm-meta-item">
                  <i class="bi bi-people"></i>
                  <strong>{{ hospital.memberCount || 0 }}</strong> members
                  <template v-if="hospital.pendingCount > 0">
                    <span class="hm-meta-pending"> · {{ hospital.pendingCount }} pending</span>
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
                  <button type="button" class="hm-btn hm-btn-add" @click.stop="openAddDoctor(hospital)">
                    <i class="bi bi-person-plus"></i> Add doctor
                  </button>
                </div>
                <div v-if="membersLoading[hospital.id]" class="hm-members-loading">
                  <div class="hm-spinner-sm" role="status"></div>
                </div>
                <div v-else-if="!membersByHospital[hospital.id] || membersByHospital[hospital.id].length === 0" class="hm-members-empty">
                  No members yet. Add a doctor by username.
                </div>
                <div v-else class="hm-members-wrap">
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
                            <button type="button" class="hm-btn hm-btn-row hm-btn-kick" title="Kick" @click="confirmAction(hospital, m, 'kick')">Kick</button>
                            <button type="button" class="hm-btn hm-btn-row hm-btn-block" title="Block" @click="confirmAction(hospital, m, 'block')">Block</button>
                          </template>
                          <template v-else-if="m.status === 'blocked'">
                            <button type="button" class="hm-btn hm-btn-row hm-btn-unblock" title="Unblock" @click="confirmAction(hospital, m, 'unblock')">Unblock</button>
                          </template>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-if="membersPagination[hospital.id] && membersPagination[hospital.id].pages > 1" class="hm-members-pagination">
                    <button type="button" class="hm-pagination-btn" :disabled="!membersPagination[hospital.id] || membersPagination[hospital.id].page <= 1"
                      @click="goToMembersPage(hospital.id, (membersPagination[hospital.id]?.page || 1) - 1)">
                      <i class="bi bi-chevron-left"></i>
                    </button>
                    <span class="hm-page-info">Page <strong>{{ membersPagination[hospital.id]?.page || 1 }}</strong> of <strong>{{ membersPagination[hospital.id]?.pages || 1 }}</strong></span>
                    <button type="button" class="hm-pagination-btn" :disabled="!membersPagination[hospital.id] || membersPagination[hospital.id].page >= membersPagination[hospital.id].pages"
                      @click="goToMembersPage(hospital.id, (membersPagination[hospital.id]?.page || 1) + 1)">
                      <i class="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div class="hm-card-actions">
                <button type="button" class="hm-btn hm-btn-primary" @click.stop="openSubscribe(hospital)">
                  <i class="bi bi-calendar-check"></i> Subscribe / Extend
                </button>
                <button v-if="hospital.admin && hospital.subscription && hospital.subscription.isActive" type="button" class="hm-btn hm-btn-danger-outline"
                  @click.stop="confirmExpireHospital(hospital)">
                  <i class="bi bi-x-circle"></i> Expire subscription
                </button>
                <button type="button" class="hm-btn hm-btn-secondary-outline" @click.stop="openChangeAdmin(hospital)">
                  <i class="bi bi-person-gear"></i> Change admin
                </button>
                <button type="button" class="hm-btn hm-btn-danger-outline" @click.stop="confirmDeleteHospital(hospital)">
                  <i class="bi bi-trash"></i> Delete hospital
                </button>
              </div>
            </div>
          </section>
        </div>
        <div v-if="!loading && pagination.pages > 1" class="hm-pagination-section">
          <button type="button" class="hm-pagination-btn" :disabled="pagination.page <= 1" @click="goToHospitalsPage(pagination.page - 1)">
            <i class="bi bi-chevron-left"></i>
          </button>
          <span class="hm-page-info">Page <strong>{{ pagination.page }}</strong> of <strong>{{ pagination.pages }}</strong></span>
          <button type="button" class="hm-pagination-btn" :disabled="pagination.page >= pagination.pages" @click="goToHospitalsPage(pagination.page + 1)">
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>

      <!-- Subscribe modal -->
      <div v-if="showSubscribeModal" class="hm-modal-overlay" @click.self="showSubscribeModal = false">
        <div class="hm-modal">
          <div class="hm-modal-header">
            <h3 class="hm-modal-title">Subscribe / Extend</h3>
            <button type="button" class="hm-modal-close" @click="showSubscribeModal = false" aria-label="Close"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="hm-modal-body">
            <p class="hm-modal-hospital-name">{{ selectedHospital ? selectedHospital.name : '' }}</p>
            <div class="hm-plan-options">
              <label v-for="plan in subscriptionPlans" :key="plan.value" class="hm-plan-option" :class="{ active: selectedPlan === plan.value }">
                <input :id="`plan-${plan.value}`" v-model="selectedPlan" type="radio" :value="plan.value" class="hm-plan-radio" />
                <span class="hm-plan-name">{{ plan.name }}</span>
                <span class="hm-plan-desc">{{ plan.description }}</span>
              </label>
            </div>
          </div>
          <div class="hm-modal-footer">
            <button type="button" class="hm-btn hm-btn-ghost" @click="showSubscribeModal = false">Cancel</button>
            <button type="button" class="hm-btn hm-btn-primary" :disabled="!selectedPlan || applyingPlan" @click="applyPlan">
              <span v-if="applyingPlan" class="hm-spinner-sm me-2" role="status"></span>
              Apply
            </button>
          </div>
        </div>
      </div>

      <!-- Create hospital modal (Owner) -->
      <div v-if="showCreateHospitalModal" class="hm-modal-overlay" @click.self="showCreateHospitalModal = false">
        <div class="hm-modal">
          <div class="hm-modal-header">
            <h3 class="hm-modal-title">Create hospital</h3>
            <button type="button" class="hm-modal-close" @click="showCreateHospitalModal = false" aria-label="Close"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="hm-modal-body">
            <p class="hm-modal-desc">Create a new hospital and assign a user as its admin. The user must be a registered doctor (or existing admin without a hospital).</p>
            <div class="hm-form-group">
              <label class="hm-form-label">Hospital name <span class="hm-required">*</span></label>
              <input v-model="createName" type="text" class="hm-form-input" placeholder="e.g. City General Hospital" />
            </div>
            <div class="hm-form-group">
              <label class="hm-form-label">Address (optional)</label>
              <input v-model="createAddress" type="text" class="hm-form-input" placeholder="Street, City" />
            </div>
            <div class="hm-form-group">
              <label class="hm-form-label">Admin user <span class="hm-required">*</span></label>
              <div v-if="usersForAdminLoading" class="hm-form-hint">Loading users...</div>
              <select v-else v-model="createAdminUserId" class="hm-form-input hm-form-select">
                <option value="">Select a user...</option>
                <option v-for="u in usersForAdmin" :key="u.id" :value="u.id">
                  {{ u.name }} (@{{ u.username }}) – {{ u.email }}
                </option>
              </select>
              <p v-if="!usersForAdminLoading && usersForAdmin.length === 0" class="hm-form-hint mt-2 mb-0">No users found. Register doctors first in User Management.</p>
            </div>
          </div>
          <div class="hm-modal-footer">
            <button type="button" class="hm-btn hm-btn-ghost" @click="showCreateHospitalModal = false">Cancel</button>
            <button type="button" class="hm-btn hm-btn-primary" :disabled="!createName.trim() || !createAdminUserId || createLoading" @click="createHospital">
              <span v-if="createLoading" class="hm-spinner-sm me-2" role="status"></span>
              Create
            </button>
          </div>
        </div>
      </div>

      <!-- Change admin modal -->
      <div v-if="showChangeAdminModal" class="hm-modal-overlay" @click.self="showChangeAdminModal = false">
        <div class="hm-modal">
          <div class="hm-modal-header">
            <h3 class="hm-modal-title">Change admin</h3>
            <button type="button" class="hm-modal-close" @click="showChangeAdminModal = false" aria-label="Close"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="hm-modal-body">
            <p class="hm-modal-desc">Select a doctor to assign as admin of {{ selectedHospital ? selectedHospital.name : '' }}.</p>
            <div v-if="doctorsLoading" class="hm-modal-loading">
              <div class="hm-spinner-sm" role="status"></div>
            </div>
            <div v-else class="hm-doctor-list">
              <label v-for="doc in doctors" :key="doc.id" class="hm-doctor-option" :class="{ active: selectedDoctorId === doc.id }">
                <input :id="`doctor-${doc.id}`" v-model="selectedDoctorId" type="radio" :value="doc.id" class="hm-doctor-radio" />
                <span>{{ doc.name }} @{{ doc.username }} ({{ doc.email }})</span>
              </label>
              <p v-if="doctors.length === 0" class="hm-form-hint mb-0">No doctors found.</p>
            </div>
          </div>
          <div class="hm-modal-footer">
            <button type="button" class="hm-btn hm-btn-ghost" @click="showChangeAdminModal = false">Cancel</button>
            <button type="button" class="hm-btn hm-btn-primary" :disabled="!selectedDoctorId || changingAdmin" @click="confirmChangeAdmin">
              <span v-if="changingAdmin" class="hm-spinner-sm me-2" role="status"></span>
              Assign admin
            </button>
          </div>
        </div>
      </div>

      <!-- Add doctor modal -->
      <div v-if="showAddDoctorModal" class="hm-modal-overlay" @click.self="showAddDoctorModal = false">
        <div class="hm-modal hm-modal-sm">
          <div class="hm-modal-header">
            <h3 class="hm-modal-title">Add doctor</h3>
            <button type="button" class="hm-modal-close" @click="showAddDoctorModal = false" aria-label="Close"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="hm-modal-body">
            <p class="hm-modal-desc">Invite a doctor to {{ selectedHospital ? selectedHospital.name : '' }} by username.</p>
            <input v-model="inviteUsername" type="text" class="hm-form-input" placeholder="Username" @keydown.enter="sendInvite" />
            <p v-if="inviteError" class="hm-form-error mt-2 mb-0">{{ inviteError }}</p>
          </div>
          <div class="hm-modal-footer">
            <button type="button" class="hm-btn hm-btn-ghost" @click="showAddDoctorModal = false">Cancel</button>
            <button type="button" class="hm-btn hm-btn-primary" :disabled="!inviteUsername.trim() || inviting" @click="sendInvite">
              <span v-if="inviting" class="hm-spinner-sm me-2" role="status"></span>
              Send invitation
            </button>
          </div>
        </div>
      </div>

      <!-- Confirm action modal (kick / block / unblock / delete) -->
      <div v-if="showConfirmModal" class="hm-modal-overlay" @click.self="showConfirmModal = false">
        <div class="hm-modal hm-modal-sm">
          <div class="hm-modal-header">
            <h3 class="hm-modal-title">{{ confirmTitle }}</h3>
            <button type="button" class="hm-modal-close" @click="showConfirmModal = false" aria-label="Close"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="hm-modal-body">
            <p class="hm-confirm-message">{{ confirmMessage }}</p>
          </div>
          <div class="hm-modal-footer">
            <button type="button" class="hm-btn hm-btn-ghost" @click="showConfirmModal = false">Cancel</button>
            <button type="button" class="hm-btn hm-btn-danger" :disabled="confirming" @click="executeConfirm">
              <span v-if="confirming" class="hm-spinner-sm me-2" role="status"></span>
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
      showCreateHospitalModal: false,
      showChangeAdminModal: false,
      showAddDoctorModal: false,
      showConfirmModal: false,
      selectedHospital: null,
      createName: '',
      createAddress: '',
      createAdminUserId: '',
      createLoading: false,
      usersForAdmin: [],
      usersForAdminLoading: false,
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
    openCreateHospital() {
      this.createName = '';
      this.createAddress = '';
      this.createAdminUserId = '';
      this.showCreateHospitalModal = true;
      this.usersForAdmin = [];
      this.usersForAdminLoading = true;
      axios.get(`${orthancApiUrl}api/users?limit=500&role=doctor,admin`, {
        headers: { Authorization: `Bearer ${this.getToken()}` }
      }).then((response) => {
        if (response.data.success) {
          this.usersForAdmin = response.data.users || [];
        }
      }).catch(() => {
        this.usersForAdmin = [];
      }).finally(() => {
        this.usersForAdminLoading = false;
      });
    },
    async createHospital() {
      if (!this.createName.trim() || !this.createAdminUserId) return;
      this.createLoading = true;
      try {
        await axios.post(
          `${orthancApiUrl}api/hospital`,
          {
            name: this.createName.trim(),
            address: this.createAddress.trim(),
            adminUserId: this.createAdminUserId
          },
          { headers: { Authorization: `Bearer ${this.getToken()}` } }
        );
        this.showCreateHospitalModal = false;
        this.toast('Hospital created successfully', 'success');
        await this.loadHospitals();
      } catch (error) {
        this.toast(error.response?.data?.error || 'Failed to create hospital', 'error');
      } finally {
        this.createLoading = false;
      }
    },
    confirmDeleteHospital(hospital) {
      this.selectedHospital = hospital;
      this.confirmMember = null;
      this.confirmActionType = 'delete_hospital';
      this.confirmTitle = 'Delete hospital';
      this.confirmMessage = `Delete "${hospital.name}" and all its data (studies, files, members, subscription)? This cannot be undone.`;
      this.confirmButtonText = 'Delete hospital';
      this.showConfirmModal = true;
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
    confirmExpireHospital(hospital) {
      if (!hospital || !hospital.admin) return;
      this.selectedHospital = hospital;
      this.confirmMember = null;
      this.confirmActionType = 'expire_hospital';
      this.confirmTitle = 'Expire subscription';
      this.confirmMessage = `Expire subscription for ${hospital.name}? Doctors in this hospital will lose access until a new subscription is created.`;
      this.confirmButtonText = 'Expire subscription';
      this.showConfirmModal = true;
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
      if (!this.confirmActionType) return;
      // For hospital-wide actions, we only need selectedHospital
      if ((this.confirmActionType === 'delete_hospital' || this.confirmActionType === 'expire_hospital') && !this.selectedHospital) return;
      // For member actions, we need both selectedHospital and confirmMember
      if (!['delete_hospital', 'expire_hospital'].includes(this.confirmActionType) && (!this.selectedHospital || !this.confirmMember)) return;
      this.confirming = true;
      try {
        if (this.confirmActionType === 'delete_hospital') {
          await axios.delete(`${orthancApiUrl}api/hospital/${this.selectedHospital.id}`, {
            headers: { Authorization: `Bearer ${this.getToken()}` }
          });
          this.toast('Hospital deleted', 'success');
          this.showConfirmModal = false;
          await this.loadHospitals();
        } else if (this.confirmActionType === 'expire_hospital') {
          await axios.post(
            `${orthancApiUrl}api/users/${this.selectedHospital.admin.id}/expire-hospital`,
            {},
            { headers: { Authorization: `Bearer ${this.getToken()}` } }
          );
          this.toast('Subscription expired', 'success');
          this.showConfirmModal = false;
          await this.loadHospitals();
        } else {
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
        }
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
/* Page – same feel as Patient / User Management */
.hm-page {
  width: 100%;
  min-height: calc(100vh - 60px);
  padding: 16px;
  background: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.hm-container {
  max-width: 960px;
  margin: 0 auto;
}

/* Header */
.hm-header {
  margin-bottom: 28px;
}

.hm-header-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.hm-header-text {
  flex: 1;
  min-width: 0;
}

.hm-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
}

.hm-subtitle {
  font-size: 0.9375rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.45;
}

/* Buttons – single design system */
.hm-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.hm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hm-btn-primary {
  background: #4a90e2;
  color: #fff;
}

.hm-btn-primary:hover:not(:disabled) {
  background: #357abd;
  box-shadow: 0 2px 8px rgba(74, 144, 226, 0.35);
}

.hm-btn-ghost {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #e5e7eb;
}

.hm-btn-ghost:hover:not(:disabled) {
  background: #e5e7eb;
  color: #1f2937;
}

.hm-btn-secondary-outline {
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.hm-btn-secondary-outline:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #374151;
}

.hm-btn-danger-outline {
  background: transparent;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.hm-btn-danger-outline:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #f87171;
}

.hm-btn-danger {
  background: #dc2626;
  color: #fff;
}

.hm-btn-danger:hover:not(:disabled) {
  background: #b91c1c;
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.35);
}

.hm-btn-add {
  background: #e8f4fd;
  color: #2563eb;
}

.hm-btn-add:hover:not(:disabled) {
  background: #d1e9fa;
}

.hm-btn-row {
  padding: 4px 10px;
  font-size: 12px;
}

.hm-btn-kick {
  background: #fef3c7;
  color: #92400e;
}

.hm-btn-kick:hover:not(:disabled) { background: #fde68a; }

.hm-btn-block {
  background: #fee2e2;
  color: #dc2626;
}

.hm-btn-block:hover:not(:disabled) { background: #fecaca; }

.hm-btn-unblock {
  background: #dcfce7;
  color: #15803d;
}

.hm-btn-unblock:hover:not(:disabled) { background: #bbf7d0; }

/* Loading */
.hm-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
}

.hm-loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid #e5e7eb;
  border-top-color: #4a90e2;
  border-radius: 50%;
  animation: hm-spin 0.8s linear infinite;
}

.hm-loading-text {
  margin: 16px 0 0 0;
  font-size: 14px;
  color: #6b7280;
}

@keyframes hm-spin {
  to { transform: rotate(360deg); }
}

.hm-spinner-sm {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid #e5e7eb;
  border-top-color: #4a90e2;
  border-radius: 50%;
  animation: hm-spin 0.8s linear infinite;
  vertical-align: middle;
}

/* Empty state */
.hm-empty {
  text-align: center;
  padding: 64px 32px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.hm-empty-icon {
  font-size: 56px;
  color: #cbd5e1;
  margin-bottom: 20px;
}

.hm-empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

.hm-empty-text {
  font-size: 14px;
  color: #6b7280;
  max-width: 400px;
  margin: 0 auto 24px;
  line-height: 1.6;
}

/* Cards – heavy, natural */
.hm-cards {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hm-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.hm-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  border-color: #e2e8f0;
}

.hm-card-head {
  padding: 24px 24px 20px;
  background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
  border-bottom: 1px solid #f1f5f9;
}

.hm-card-hero {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 12px;
}

.hm-card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hm-card-icon i {
  font-size: 24px;
  color: #fff;
}

.hm-card-titles {
  flex: 1;
  min-width: 0;
}

.hm-card-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.hm-card-id {
  font-size: 12px;
  font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 6px;
  display: inline-block;
}

.hm-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
  flex-shrink: 0;
}

.hm-badge-sub.hm-badge-active {
  background: #dcfce7;
  color: #15803d;
}

.hm-badge-sub.hm-badge-expired {
  background: #fee2e2;
  color: #dc2626;
}

.hm-badge-status {
  background: #f3f4f6;
  color: #374151;
}

.hm-status-accepted { background: #dcfce7 !important; color: #15803d !important; }
.hm-status-pending,
.hm-status-pending_invitation { background: #fef3c7 !important; color: #92400e !important; }
.hm-status-blocked { background: #fee2e2 !important; color: #dc2626 !important; }
.hm-status-kicked { background: #f3f4f6 !important; color: #6b7280 !important; }

.hm-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: #6b7280;
}

.hm-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.hm-meta-item i {
  color: #9ca3af;
  font-size: 14px;
}

.hm-meta-item strong {
  color: #374151;
}

.hm-meta-pending {
  color: #9ca3af;
}

.hm-meta-admin .hm-meta-detail {
  color: #9ca3af;
  font-weight: 400;
}

.hm-card-address {
  font-size: 13px;
  color: #6b7280;
  margin: 10px 0 0 0;
  line-height: 1.45;
}

.hm-card-body {
  padding: 20px 24px 24px;
  background: #fff;
  border-top: 1px solid #f1f5f9;
}

/* Members section */
.hm-members-section {
  margin-bottom: 20px;
}

.hm-members-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.hm-section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  margin: 0;
}

.hm-members-loading {
  padding: 32px;
  text-align: center;
}

.hm-members-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px dashed #e2e8f0;
}

.hm-members-wrap {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.hm-members-table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}

.hm-members-table th {
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

.hm-members-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  vertical-align: middle;
}

.hm-members-table tbody tr:last-child td {
  border-bottom: none;
}

.hm-members-table tbody tr:hover td {
  background: #fafbfc;
}

.hm-cell-email {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #6b7280;
}

.hm-col-actions {
  white-space: nowrap;
  text-align: right;
}

.hm-col-actions .hm-btn {
  margin-left: 6px;
}

.hm-members-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  background: #fafbfc;
}

.hm-pagination-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 0 8px;
}

.hm-pagination-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 16px;
}

.hm-pagination-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.hm-pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hm-page-info {
  font-size: 14px;
  color: #6b7280;
}

.hm-page-info strong {
  color: #1f2937;
}

.hm-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 18px;
  border-top: 1px solid #e5e7eb;
}

/* Modals – modern, heavy */
.hm-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 20px;
  animation: hm-fadeIn 0.2s ease-out;
}

@keyframes hm-fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.hm-modal {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.1);
  max-width: 440px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: hm-modalIn 0.25s ease-out;
}

.hm-modal-sm {
  max-width: 400px;
}

@keyframes hm-modalIn {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.hm-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.hm-modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
  letter-spacing: -0.02em;
}

.hm-modal-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 18px;
}

.hm-modal-close:hover {
  background: #f3f4f6;
  color: #111827;
}

.hm-modal-body {
  padding: 24px;
  overflow-y: auto;
  background: #fff;
}

.hm-modal-desc {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.55;
  margin: 0 0 20px 0;
}

.hm-modal-hospital-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 16px 0;
}

.hm-modal-loading {
  padding: 24px;
  text-align: center;
}

.hm-confirm-message {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  margin: 0;
}

/* Plan options */
.hm-plan-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hm-plan-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #fff;
}

.hm-plan-option:hover {
  border-color: #c7d2fe;
  background: #f8fafc;
}

.hm-plan-option.active {
  border-color: #4a90e2;
  background: #e8f4fd;
}

.hm-plan-radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.hm-plan-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 14px;
}

.hm-plan-desc {
  font-size: 13px;
  color: #6b7280;
  margin-left: auto;
}

/* Form */
.hm-form-group {
  margin-bottom: 18px;
}

.hm-form-group:last-child {
  margin-bottom: 0;
}

.hm-form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.hm-required {
  color: #dc2626;
}

.hm-form-input {
  width: 100%;
  height: 40px;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  color: #1f2937;
  transition: all 0.15s ease;
  font-family: inherit;
}

.hm-form-input:focus {
  outline: none;
  border-color: #4a90e2;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.15);
}

.hm-form-input::placeholder {
  color: #9ca3af;
}

.hm-form-select {
  height: 40px;
  cursor: pointer;
  appearance: auto;
}

.hm-form-hint {
  font-size: 13px;
  color: #6b7280;
}

.hm-form-error {
  font-size: 13px;
  color: #dc2626;
}

/* Doctor list */
.hm-doctor-list {
  max-height: 280px;
  overflow-y: auto;
}

.hm-doctor-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: 4px;
  font-size: 14px;
  color: #374151;
}

.hm-doctor-option:hover {
  background: #f8fafc;
}

.hm-doctor-option.active {
  background: #e8f4fd;
  border-color: #4a90e2;
}

.hm-doctor-radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.hm-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.mt-2 { margin-top: 8px; }
.mb-0 { margin-bottom: 0; }
.me-2 { margin-right: 8px; }
</style>
