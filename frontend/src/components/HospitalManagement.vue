<template>
  <div class="hospital-management">
    <div class="container-fluid py-4">
      <div class="header-section">
        <h2 class="mb-0">Hospital Management</h2>
        <p class="text-muted mb-0">Manage hospitals, subscriptions, and assign admins.</p>
      </div>

      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>

      <div v-else-if="hospitals.length === 0" class="empty-state card shadow-sm">
        <div class="card-body text-center py-5">
          <i class="bi bi-building display-4 text-muted mb-3"></i>
          <h5 class="text-muted">No hospitals yet</h5>
          <p class="text-muted mb-0">Hospitals are created by admins. Assign an admin in User Management or wait for an admin to create a hospital.</p>
        </div>
      </div>

      <div v-else class="hospital-cards">
        <div
          v-for="hospital in hospitals"
          :key="hospital.id"
          class="card hospital-card shadow-sm"
        >
          <div class="card-body">
            <div class="hospital-header">
              <div>
                <h5 class="hospital-name">{{ hospital.name }}</h5>
                <span class="hospital-id badge bg-light text-dark">{{ hospital.hospitalId }}</span>
              </div>
              <span
                class="subscription-badge"
                :class="{
                  'badge-active': hospital.subscription && hospital.subscription.isActive,
                  'badge-expired': !hospital.subscription || !hospital.subscription.isActive
                }"
              >
                {{ subscriptionLabel(hospital) }}
              </span>
            </div>
            <p v-if="hospital.address" class="text-muted small mb-3">{{ hospital.address }}</p>

            <div class="admin-section">
              <h6 class="section-label">Admin</h6>
              <div v-if="hospital.admin" class="admin-info">
                <span class="admin-name">{{ hospital.admin.name }}</span>
                <span class="admin-detail">@{{ hospital.admin.username }}</span>
                <span class="admin-detail">{{ hospital.admin.email }}</span>
                <div class="admin-actions mt-2">
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-primary me-2"
                    @click="openChangeAdmin(hospital)"
                  >
                    <i class="bi bi-person-plus me-1"></i>Change admin
                  </button>
                </div>
              </div>
              <div v-else class="text-muted">No admin assigned</div>
            </div>

            <div v-if="hospital.subscription && hospital.subscription.planType !== 'forever'" class="subscription-detail small text-muted mb-3">
              Expires: {{ formatDate(hospital.subscription.expiresAt) }}
              <span v-if="hospital.subscription.daysUntilExpiration !== null">
                ({{ Math.max(0, hospital.subscription.daysUntilExpiration) }} days left)
              </span>
            </div>

            <div class="card-actions">
              <button
                type="button"
                class="btn btn-sm btn-primary"
                @click="openSubscribe(hospital)"
              >
                <i class="bi bi-calendar-check me-1"></i>Subscribe / Extend
              </button>
              <button
                v-if="hospital.admin && hospital.subscription && hospital.subscription.isActive"
                type="button"
                class="btn btn-sm btn-outline-danger"
                @click="expireHospital(hospital)"
              >
                <i class="bi bi-x-circle me-1"></i>Expire
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Subscribe modal -->
      <div v-if="showSubscribeModal" class="modal-overlay" @click.self="showSubscribeModal = false">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Subscribe / Extend</h5>
              <button type="button" class="btn-close" @click="showSubscribeModal = false" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3">{{ selectedHospital ? selectedHospital.name : '' }}</p>
              <div class="plan-options">
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
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showSubscribeModal = false">Cancel</button>
              <button type="button" class="btn btn-primary" :disabled="!selectedPlan || applyingPlan" @click="applyPlan">
                <span v-if="applyingPlan" class="spinner-border spinner-border-sm me-2"></span>
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Change admin modal -->
      <div v-if="showChangeAdminModal" class="modal-overlay" @click.self="showChangeAdminModal = false">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Change admin</h5>
              <button type="button" class="btn-close" @click="showChangeAdminModal = false" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted small mb-3">Select a doctor to assign as admin of {{ selectedHospital ? selectedHospital.name : '' }}.</p>
              <div v-if="doctorsLoading" class="text-center py-3">
                <div class="spinner-border spinner-border-sm" role="status"></div>
              </div>
              <div v-else class="doctor-list">
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
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showChangeAdminModal = false">Cancel</button>
              <button type="button" class="btn btn-primary" :disabled="!selectedDoctorId || changingAdmin" @click="confirmChangeAdmin">
                <span v-if="changingAdmin" class="spinner-border spinner-border-sm me-2"></span>
                Assign admin
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
  name: 'HospitalManagement',
  data() {
    return {
      hospitals: [],
      loading: true,
      showSubscribeModal: false,
      showChangeAdminModal: false,
      selectedHospital: null,
      selectedPlan: null,
      selectedDoctorId: null,
      doctors: [],
      doctorsLoading: false,
      applyingPlan: false,
      changingAdmin: false,
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
    async loadHospitals() {
      this.loading = true;
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.get(`${orthancApiUrl}api/hospital/all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          this.hospitals = response.data.hospitals || [];
        }
      } catch (error) {
        if (error.response?.status === 403) {
          this.$router.push('/');
        } else {
          console.error('Load hospitals error:', error);
        }
      } finally {
        this.loading = false;
      }
    },
    subscriptionLabel(hospital) {
      if (!hospital.subscription) return 'No plan';
      if (hospital.subscription.planType === 'forever') return 'Forever';
      if (hospital.subscription.isActive) return `${hospital.subscription.planType === 'monthly' ? 'Monthly' : 'Yearly'} (active)`;
      return 'Expired';
    },
    formatDate(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
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
        const token = localStorage.getItem('auth-token');
        await axios.post(
          `${orthancApiUrl}api/subscriptions/${this.selectedHospital.id}`,
          { planType: this.selectedPlan },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        this.showSubscribeModal = false;
        await this.loadHospitals();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to apply plan');
      } finally {
        this.applyingPlan = false;
      }
    },
    async expireHospital(hospital) {
      if (!hospital.admin || !confirm(`Expire subscription for ${hospital.name}?`)) return;
      try {
        const token = localStorage.getItem('auth-token');
        await axios.post(
          `${orthancApiUrl}api/users/${hospital.admin.id}/expire-hospital`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await this.loadHospitals();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to expire hospital');
      }
    },
    async openChangeAdmin(hospital) {
      this.selectedHospital = hospital;
      this.selectedDoctorId = null;
      this.showChangeAdminModal = true;
      this.doctorsLoading = true;
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.get(`${orthancApiUrl}api/users?limit=200`, {
          headers: { Authorization: `Bearer ${token}` }
        });
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
        const token = localStorage.getItem('auth-token');
        await axios.put(
          `${orthancApiUrl}api/hospital/${this.selectedHospital.id}/admin`,
          { userId: this.selectedDoctorId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        this.showChangeAdminModal = false;
        await this.loadHospitals();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to change admin');
      } finally {
        this.changingAdmin = false;
      }
    }
  }
};
</script>

<style scoped>
.hospital-management {
  padding: 0 4px;
}

.header-section {
  margin-bottom: 24px;
}

.header-section h2 {
  font-size: 1.5rem;
  font-weight: 600;
}

.hospital-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.hospital-card {
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.hospital-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.hospital-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.hospital-id {
  font-size: 0.75rem;
}

.subscription-badge {
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 500;
}

.subscription-badge.badge-active {
  background: #d1fae5;
  color: #065f46;
}

.subscription-badge.badge-expired {
  background: #fee2e2;
  color: #991b1b;
}

.section-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  margin-bottom: 6px;
}

.admin-section {
  margin-bottom: 16px;
}

.admin-info {
  font-size: 0.9rem;
}

.admin-name {
  font-weight: 500;
  display: block;
}

.admin-detail {
  display: block;
  color: #6b7280;
  font-size: 0.85rem;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 20px;
}

.modal-overlay .modal-dialog {
  background: var(--bs-body-bg, #fff);
  border-radius: 12px;
  max-width: 440px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-overlay .modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-overlay .modal-body {
  padding: 20px;
}

.modal-overlay .modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}

.plan-options .form-check {
  padding-left: 1.5rem;
}

.doctor-list {
  max-height: 280px;
  overflow-y: auto;
}

.empty-state .card-body {
  border-radius: 12px;
}
</style>
