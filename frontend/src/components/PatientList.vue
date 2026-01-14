<script>
import Toasts from "./Toasts.vue"
import api from "../orthancApi"

export default {
    name: 'PatientList',
    components: { Toasts },
    data() {
        return {
            patients: [],
            filteredPatients: [],
            loading: false,
            expandedPatientId: null,
            // Search filters
            filterPatientId: '',
            filterPatientName: '',
            filterPatientBirthDate: ''
        };
    },
    async created() {
        await this.loadPatients();
    },
    watch: {
        filterPatientId() {
            this.applyFilters();
        },
        filterPatientName() {
            this.applyFilters();
        },
        filterPatientBirthDate() {
            this.applyFilters();
        },
        patients() {
            this.applyFilters();
        }
    },
    methods: {
        async loadPatients() {
            this.loading = true;
            try {
                const response = await api.getPatients();
                if (response.success) {
                    this.patients = response.patients || [];
                    this.applyFilters();
                }
            } catch (error) {
                console.error('Error loading patients:', error);
                this.messageBus.emit('show-toast', 'Failed to load patients');
            } finally {
                this.loading = false;
            }
        },
        applyFilters() {
            let filtered = [...this.patients];
            
            if (this.filterPatientId.trim()) {
                const search = this.filterPatientId.toLowerCase();
                filtered = filtered.filter(patient => 
                    patient.patientId.toLowerCase().includes(search)
                );
            }
            
            if (this.filterPatientName.trim()) {
                const search = this.filterPatientName.toLowerCase();
                filtered = filtered.filter(patient => 
                    patient.patientName.toLowerCase().includes(search)
                );
            }
            
            if (this.filterPatientBirthDate.trim()) {
                const search = this.filterPatientBirthDate.toLowerCase();
                filtered = filtered.filter(patient => 
                    patient.patientBirthDate.toLowerCase().includes(search)
                );
            }
            
            this.filteredPatients = filtered;
        },
        clearFilters() {
            this.filterPatientId = '';
            this.filterPatientName = '';
            this.filterPatientBirthDate = '';
        },
        toggleExpand(patientId) {
            if (this.expandedPatientId === patientId) {
                this.expandedPatientId = null;
            } else {
                this.expandedPatientId = patientId;
            }
        },
        isExpanded(patientId) {
            return this.expandedPatientId === patientId;
        },
        viewDicomFiles(patient) {
            // Navigate to DICOM studies list with patient ID filter
            this.$router.push({
                path: '/filtered-studies',
                query: { PatientID: patient.patientId }
            });
        },
        viewWordFiles(patient) {
            // Navigate to Word files list with patient ID filter
            this.$router.push({
                path: '/word-files',
                query: { patientId: patient.patientId }
            });
        },
        formatDate(dateString) {
            if (!dateString) return '-';
            // Handle DICOM date format (YYYYMMDD)
            if (dateString.length === 8 && !dateString.includes('-')) {
                const year = dateString.substring(0, 4);
                const month = dateString.substring(4, 6);
                const day = dateString.substring(6, 8);
                return `${year}-${month}-${day}`;
            }
            // Handle ISO date
            if (dateString.includes('T')) {
                const date = new Date(dateString);
                return date.toLocaleDateString();
            }
            return dateString;
        },
        formatPatientName(name) {
            if (!name) return '-';
            // Convert DICOM format (Last^First) to readable format
            return name.replace(/\^/g, ', ').replace(/\s+/g, ' ').trim();
        }
    }
}
</script>

<template>
    <div>
        <table class="table table-sm study-table table-borderless">
            <thead class="sticky-top">
                <tr class="study-column-titles">
                    <th width="20%" class="study-table-title" scope="col">Patient ID</th>
                    <th width="25%" class="study-table-title" scope="col">Patient Name</th>
                    <th width="15%" class="study-table-title" scope="col">Birth Date</th>
                    <th width="10%" class="study-table-title" scope="col">Sex</th>
                    <th width="15%" class="study-table-title" scope="col">DICOM Studies</th>
                    <th width="15%" class="study-table-title" scope="col">Documents</th>
                </tr>
                <tr class="study-table-filters">
                    <th scope="col">
                        <div class="d-flex">
                            <button @click="clearFilters" type="button" class="form-control study-list-filter btn filter-button btn-sm me-1"
                                style="max-width: 40px;" data-bs-toggle="tooltip" title="Clear filter">
                                <i class="fa-regular fa-circle-xmark"></i>
                            </button>
                            <input type="text" class="form-control study-list-filter" v-model="filterPatientId" placeholder="Search...">
                        </div>
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterPatientName" placeholder="Search...">
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterPatientBirthDate" placeholder="YYYYMMDD">
                    </th>
                    <th></th>
                    <th></th>
                    <th></th>
                </tr>
                <tr class="study-table-actions">
                    <th colspan="6" scope="col">
                        <div class="container px-0">
                            <div class="row g-1">
                                <div class="col-4">
                                    <div v-if="loading" class="alert alert-secondary study-list-alert" role="alert">
                                        <span class="spinner-border spinner-border-sm alert-icon" role="status" aria-hidden="true"></span>
                                        Loading...
                                    </div>
                                    <div v-else-if="filteredPatients.length === 0" class="alert alert-warning study-list-alert" role="alert">
                                        <i class="bi bi-exclamation-triangle-fill alert-icon"></i> No patients found
                                    </div>
                                    <div v-else class="alert alert-info study-list-alert modern-badge" role="alert">
                                        <i class="bi bi-people-fill alert-icon"></i> {{ filteredPatients.length }} patient(s)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody v-if="loading">
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="spinner-border" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </td>
                </tr>
            </tbody>
            <tbody v-else-if="filteredPatients.length === 0">
                <tr>
                    <td colspan="6" class="text-center text-muted" style="padding: 20px;">
                        No patients found
                    </td>
                </tr>
            </tbody>
            <tbody v-for="patient in filteredPatients" :key="patient.id">
                <tr 
                    class="patient-row" 
                    :class="{ 'patient-row-expanded': isExpanded(patient.id) }"
                    @click="toggleExpand(patient.id)"
                    style="cursor: pointer;"
                >
                    <td class="cut-text" data-bs-toggle="tooltip" :title="patient.patientId">
                        {{ patient.patientId }}
                    </td>
                    <td class="cut-text" data-bs-toggle="tooltip" :title="formatPatientName(patient.patientName)">
                        {{ formatPatientName(patient.patientName) }}
                    </td>
                    <td class="cut-text">
                        {{ formatDate(patient.patientBirthDate) }}
                    </td>
                    <td class="cut-text">
                        {{ patient.patientSex || '-' }}
                    </td>
                    <td class="text-center">
                        <span class="badge bg-primary">{{ patient.dicomStudyCount }}</span>
                    </td>
                    <td class="text-center">
                        <span class="badge bg-secondary">{{ patient.wordFileCount }}</span>
                    </td>
                </tr>
                <tr v-if="isExpanded(patient.id)" class="patient-details-row">
                    <td colspan="6">
                        <div class="patient-details">
                            <div class="patient-info-grid">
                                <div class="patient-info-section">
                                    <h6><i class="bi bi-person-fill me-2"></i>Patient Information</h6>
                                    <div class="info-row">
                                        <span class="info-label">Patient ID:</span>
                                        <span class="info-value">{{ patient.patientId }}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">Patient Name:</span>
                                        <span class="info-value">{{ formatPatientName(patient.patientName) }}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">Birth Date:</span>
                                        <span class="info-value">{{ formatDate(patient.patientBirthDate) }}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">Sex:</span>
                                        <span class="info-value">{{ patient.patientSex || '-' }}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">Other IDs:</span>
                                        <span class="info-value">{{ patient.otherPatientIds || '-' }}</span>
                                    </div>
                                </div>
                                <div class="patient-actions-section">
                                    <h6><i class="bi bi-folder2-open me-2"></i>View Patient Files</h6>
                                    <div class="action-buttons">
                                        <button 
                                            class="btn btn-primary action-btn"
                                            @click.stop="viewDicomFiles(patient)"
                                            :disabled="patient.dicomStudyCount === 0"
                                        >
                                            <i class="bi bi-file-earmark-medical me-2"></i>
                                            View DICOM Studies ({{ patient.dicomStudyCount }})
                                        </button>
                                        <button 
                                            class="btn btn-secondary action-btn"
                                            @click.stop="viewWordFiles(patient)"
                                            :disabled="patient.wordFileCount === 0"
                                        >
                                            <i class="bi bi-file-earmark-word me-2"></i>
                                            View Documents ({{ patient.wordFileCount }})
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
        <Toasts />
    </div>
</template>

<style scoped>
.study-table {
    table-layout: fixed;
}

.study-table> :nth-child(odd) >tr >td{
    background-color: var(--study-odd-bg-color);
}

.study-table> :nth-child(even) >tr >td{
    background-color: var(--study-even-bg-color);
}

.study-table>tbody>tr:first-child:hover > * {
    background-color: var(--study-hover-color);
}

.study-table tr:hover {
    background-color: var(--study-hover-color);
}

.study-table> :last-child {
    border-bottom-width: thin;
}

.study-column-titles {
    background-color: var(--study-table-header-bg-color) !important;
    font-size: smaller;
}

.study-table-title {
    text-align: left;
    padding-left: 4px;
    padding-right: 4px;
    padding-top: 14px;
    padding-bottom: 14px;
    vertical-align: middle !important;
    line-height: 1.5;
    position: sticky;
}

.study-table-filters {
    background-color: var(--study-table-filter-bg-color);
}

.study-table-filters > th {
    background-color: var(--study-table-filter-bg-color);
}

.study-table-actions {
    background-color: var(--study-table-actions-bg-color) !important;
}

.study-table-actions > th {
    background-color: var(--study-table-actions-bg-color) !important;
    vertical-align: middle;
}

.study-table td {
    text-align: left;
    padding-left: 10px;
}

input.form-control.study-list-filter {
    margin-top: var(--filter-margin, 5px);
    margin-bottom: var(--filter-margin, 5px);
    padding-top: var(--filter-padding, 2px);
    padding-bottom: var(--filter-padding, 2px);
    padding-left: 4px;
    padding-right: 4px;
    border-bottom-width: thin;
}

.filter-button {
    border-bottom-width: thin !important;
    border-color: var(--bs-border-color);
}

.study-list-alert {
    margin-top: var(--filter-margin, 5px);
    margin-bottom: var(--filter-margin, 5px);
    padding-top: var(--filter-padding, 2px);
}

.alert-icon {
    margin-right: 0.7rem;
}

.cut-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.patient-row {
    border-top-width: 1px;
    border-color: #ddd;
    transition: background-color 0.2s;
}

.patient-row-expanded {
    background-color: var(--study-details-bg-color) !important;
    font-weight: 600;
}

.patient-row-expanded > td {
    background-color: var(--study-details-bg-color) !important;
}

.patient-details-row {
    background-color: var(--study-details-bg-color) !important;
}

.patient-details-row > td {
    background-color: var(--study-details-bg-color) !important;
    padding: 0 !important;
}

.patient-details {
    padding: 20px;
    background-color: var(--study-details-bg-color);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.patient-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
}

.patient-info-section h6,
.patient-actions-section h6 {
    margin-bottom: 15px;
    color: var(--bs-body-color);
    font-weight: 600;
}

.info-row {
    display: flex;
    margin-bottom: 8px;
}

.info-label {
    font-weight: 500;
    color: var(--bs-secondary-color);
    min-width: 120px;
}

.info-value {
    color: var(--bs-body-color);
}

.action-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.action-btn {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 10px 20px;
    border-radius: 8px;
    transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
    transform: translateX(5px);
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.modern-badge {
    background: rgba(74, 144, 226, 0.1) !important;
    border: 1px solid rgba(74, 144, 226, 0.2) !important;
    border-radius: 8px !important;
    color: #357abd !important;
    padding: 10px 16px !important;
    font-size: 0.875rem !important;
    font-weight: 500 !important;
}

@media (max-width: 768px) {
    .patient-info-grid {
        grid-template-columns: 1fr;
    }
}
</style>
