<template>
  <div class="hospital-settings">
    <div class="container-fluid py-4">
      <h2 class="mb-4">Hospital Management</h2>
      
      <!-- No Hospital - Create Form -->
      <div v-if="!hospital && !loading" class="card shadow-sm">
        <div class="card-body">
          <div class="text-center py-4">
            <i class="bi bi-hospital display-1 text-muted mb-3"></i>
            <h5>Create Your Hospital</h5>
            <p class="text-muted mb-4">
              As an admin, you can create and manage one hospital. <br>
              Doctors can join your hospital using the Hospital ID.
            </p>
          </div>
          
          <form @submit.prevent="createHospital">
            <div class="form-row mb-3">
              <label for="hospitalName" class="form-label">Hospital Name *</label>
              <input 
                type="text" 
                class="form-control" 
                id="hospitalName" 
                v-model="form.name"
                required
                placeholder="Enter hospital name"
              />
            </div>
            <div class="form-row mb-3">
              <label for="hospitalAddress" class="form-label">Address</label>
              <textarea 
                class="form-control" 
                id="hospitalAddress" 
                v-model="form.address"
                rows="2"
                placeholder="Enter hospital address (optional)"
              ></textarea>
            </div>
            <div v-if="error" class="alert alert-danger">
              <i class="bi bi-exclamation-circle me-2"></i>{{ error }}
            </div>
            <div class="form-row">
              <div class="form-label"></div>
              <button type="submit" class="btn btn-primary" :disabled="createLoading || !form.name">
                <span v-if="createLoading" class="spinner-border spinner-border-sm me-2"></span>
                {{ createLoading ? 'Creating...' : 'Create Hospital' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Hospital Info Card -->
      <div v-if="hospital" class="card mb-4 shadow-sm">
        <div class="card-body">
          <div class="hospital-header">
            <h5 class="card-title mb-0">
              <i class="bi bi-building me-2"></i>{{ hospital.name }}
            </h5>
            <div class="hospital-actions">
              <button 
                class="btn btn-sm btn-outline-primary me-2"
                @click="showEditModal = true"
              >
                <i class="bi bi-pencil me-1"></i>Edit
              </button>
              <button 
                class="btn btn-sm btn-outline-danger"
                @click="confirmDelete"
              >
                <i class="bi bi-trash me-1"></i>Delete
              </button>
            </div>
          </div>
          
          <div class="hospital-details mt-4">
            <div class="detail-row">
              <div class="detail-label">Hospital ID</div>
              <div class="detail-value">
                <code class="hospital-id">{{ hospital.hospitalId }}</code>
                <button 
                  class="btn btn-sm btn-link copy-btn"
                  @click="copyHospitalId"
                  title="Copy to clipboard"
                >
                  <i class="bi bi-clipboard"></i>
                </button>
                <span v-if="copied" class="copied-badge">Copied!</span>
              </div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Address</div>
              <div class="detail-value">{{ hospital.address || 'Not specified' }}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Members</div>
              <div class="detail-value">
                <span class="member-count">{{ hospital.memberCount || 0 }} active</span>
                <span v-if="hospital.pendingCount > 0" class="pending-count ms-2">
                  {{ hospital.pendingCount }} pending
                </span>
              </div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Created</div>
              <div class="detail-value">{{ formatDate(hospital.createdAt) }}</div>
            </div>
          </div>

          <div class="share-info mt-4">
            <div class="alert alert-info mb-0">
              <i class="bi bi-info-circle me-2"></i>
              Share this Hospital ID (<strong>{{ hospital.hospitalId }}</strong>) with doctors so they can request to join your hospital.
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Card -->
      <div v-if="hospital" class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title mb-4">
            <i class="bi bi-graph-up me-2"></i>Quick Stats
          </h5>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ hospital.memberCount || 0 }}</div>
              <div class="stat-label">Active Members</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ hospital.pendingCount || 0 }}</div>
              <div class="stat-label">Pending Requests</div>
            </div>
          </div>
          <div class="mt-3">
            <router-link to="/members" class="btn btn-outline-primary btn-sm">
              <i class="bi bi-people me-1"></i>Manage Members
            </router-link>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>

      <!-- Edit Modal -->
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Edit Hospital</h5>
              <button type="button" class="btn-close" @click="showEditModal = false"></button>
            </div>
            <form @submit.prevent="updateHospital">
              <div class="modal-body">
                <div class="mb-3">
                  <label for="editName" class="form-label">Hospital Name *</label>
                  <input 
                    type="text" 
                    class="form-control" 
                    id="editName" 
                    v-model="editForm.name"
                    required
                  />
                </div>
                <div class="mb-3">
                  <label for="editAddress" class="form-label">Address</label>
                  <textarea 
                    class="form-control" 
                    id="editAddress" 
                    v-model="editForm.address"
                    rows="2"
                  ></textarea>
                </div>
                <div v-if="editError" class="alert alert-danger">{{ editError }}</div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showEditModal = false">Cancel</button>
                <button type="submit" class="btn btn-primary" :disabled="updateLoading">
                  <span v-if="updateLoading" class="spinner-border spinner-border-sm me-2"></span>
                  {{ updateLoading ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title text-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>Delete Hospital
              </h5>
              <button type="button" class="btn-close" @click="showDeleteModal = false"></button>
            </div>
            <div class="modal-body">
              <p>Are you sure you want to delete <strong>{{ hospital?.name }}</strong>?</p>
              <p class="text-danger mb-0">
                <i class="bi bi-exclamation-circle me-1"></i>
                This action cannot be undone. All member associations will be removed.
              </p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">Cancel</button>
              <button type="button" class="btn btn-danger" @click="deleteHospital" :disabled="deleteLoading">
                <span v-if="deleteLoading" class="spinner-border spinner-border-sm me-2"></span>
                {{ deleteLoading ? 'Deleting...' : 'Delete Hospital' }}
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
  name: 'HospitalSettings',
  data() {
    return {
      hospital: null,
      loading: true,
      error: '',
      form: {
        name: '',
        address: ''
      },
      editForm: {
        name: '',
        address: ''
      },
      createLoading: false,
      updateLoading: false,
      deleteLoading: false,
      showEditModal: false,
      showDeleteModal: false,
      editError: '',
      copied: false
    };
  },
  async mounted() {
    await this.loadHospital();
  },
  methods: {
    async loadHospital() {
      this.loading = true;
      this.error = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.get(`${orthancApiUrl}api/hospital`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          this.hospital = response.data.hospital;
          if (this.hospital) {
            this.editForm = {
              name: this.hospital.name,
              address: this.hospital.address || ''
            };
          }
        }
      } catch (error) {
        console.error('Error loading hospital:', error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          this.$router.push('/login');
        }
      } finally {
        this.loading = false;
      }
    },
    
    async createHospital() {
      this.createLoading = true;
      this.error = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.post(
          `${orthancApiUrl}api/hospital`,
          this.form,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.hospital = response.data.hospital;
          this.form = { name: '', address: '' };
          this.editForm = {
            name: this.hospital.name,
            address: this.hospital.address || ''
          };
        }
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to create hospital';
      } finally {
        this.createLoading = false;
      }
    },
    
    async updateHospital() {
      this.updateLoading = true;
      this.editError = '';
      
      try {
        const token = localStorage.getItem('auth-token');
        const response = await axios.put(
          `${orthancApiUrl}api/hospital`,
          this.editForm,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          this.hospital = { ...this.hospital, ...response.data.hospital };
          this.showEditModal = false;
        }
      } catch (error) {
        this.editError = error.response?.data?.error || 'Failed to update hospital';
      } finally {
        this.updateLoading = false;
      }
    },
    
    confirmDelete() {
      this.showDeleteModal = true;
    },
    
    async deleteHospital() {
      this.deleteLoading = true;
      
      try {
        const token = localStorage.getItem('auth-token');
        await axios.delete(`${orthancApiUrl}api/hospital`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        this.hospital = null;
        this.showDeleteModal = false;
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to delete hospital');
      } finally {
        this.deleteLoading = false;
      }
    },
    
    async copyHospitalId() {
      try {
        await navigator.clipboard.writeText(this.hospital.hospitalId);
        this.copied = true;
        setTimeout(() => {
          this.copied = false;
        }, 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    },
    
    formatDate(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }
};
</script>

<style scoped>
.hospital-settings {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hospital-settings .container-fluid {
  max-width: 700px;
  width: 100%;
}

.card {
  border: none;
  border-radius: 12px;
}

.card-title {
  font-weight: 600;
  color: #374151;
}

.hospital-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.hospital-details {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
}

.detail-row {
  display: flex;
  padding: 10px 0;
  border-bottom: 1px solid #e5e7eb;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  flex: 0 0 120px;
  font-weight: 500;
  color: #6b7280;
}

.detail-value {
  flex: 1;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hospital-id {
  background: #e5e7eb;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 1px;
}

.copy-btn {
  padding: 2px 6px;
  color: #6b7280;
}

.copy-btn:hover {
  color: #4a90e2;
}

.copied-badge {
  font-size: 0.75rem;
  color: #059669;
  font-weight: 500;
}

.member-count {
  background: #d1fae5;
  color: #065f46;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.pending-count {
  background: #fef3c7;
  color: #92400e;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-item {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #4a90e2;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 4px;
}

.form-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.form-row .form-label {
  flex: 0 0 140px;
  font-weight: 500;
  color: #4b5563;
  padding-top: 8px;
  text-align: right;
}

.form-row .form-control,
.form-row textarea {
  flex: 1;
}

.form-control,
textarea {
  border-radius: 8px;
  border: 1px solid #d1d5db;
  padding: 10px 14px;
}

.form-control:focus,
textarea:focus {
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  outline: none;
}

.btn-primary {
  background-color: #4a90e2;
  border-color: #4a90e2;
  border-radius: 8px;
  padding: 10px 24px;
  font-weight: 500;
}

.btn-primary:hover {
  background-color: #357abd;
  border-color: #357abd;
}

.btn-outline-primary {
  border-color: #4a90e2;
  color: #4a90e2;
}

.btn-outline-primary:hover {
  background-color: #4a90e2;
  color: white;
}

.btn-outline-danger {
  border-color: #dc2626;
  color: #dc2626;
}

.btn-outline-danger:hover {
  background-color: #dc2626;
  color: white;
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

.alert-info {
  background-color: #e0f2fe;
  border: none;
  color: #0369a1;
  border-radius: 8px;
}

.share-info {
  margin-top: 20px;
}

@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 8px;
  }
  
  .form-row .form-label {
    flex: none;
    text-align: left;
  }
  
  .hospital-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
