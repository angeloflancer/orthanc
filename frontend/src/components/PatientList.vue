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
            uploadTargetPatient: null,
            uploadingDocumentPatientId: null,
            // Search filters
            filterPatientId: '',
            filterPatientName: '',
            filterPatientBirthDate: null,
            filterPatientSex: '',
            filterLastReported: null
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
        filterPatientSex() {
            this.applyFilters();
        },
        filterLastReported() {
            this.applyFilters();
        },
        patients() {
            this.applyFilters();
        }
    },
    computed: {
        isEmpty() {
            return !this.loading && this.filteredPatients.length === 0;
        },
        sexOptions() {
            return [
                { value: '', label: 'All' },
                { value: 'M', label: 'Male' },
                { value: 'F', label: 'Female' },
                { value: 'O', label: 'Other' }
            ];
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
            
            // Birth date filter using datepicker
            if (this.filterPatientBirthDate) {
                const filterDate = Array.isArray(this.filterPatientBirthDate) ? this.filterPatientBirthDate : [this.filterPatientBirthDate];
                if (filterDate.length >= 1 && filterDate[0]) {
                    const startDate = new Date(filterDate[0]);
                    startDate.setHours(0, 0, 0, 0);
                    filtered = filtered.filter(patient => {
                        const birthDate = this.parseDicomDate(patient.patientBirthDate);
                        return birthDate && birthDate >= startDate;
                    });
                }
                if (filterDate.length >= 2 && filterDate[1]) {
                    const endDate = new Date(filterDate[1]);
                    endDate.setHours(23, 59, 59, 999);
                    filtered = filtered.filter(patient => {
                        const birthDate = this.parseDicomDate(patient.patientBirthDate);
                        return birthDate && birthDate <= endDate;
                    });
                }
            }
            
            if (this.filterPatientSex) {
                filtered = filtered.filter(patient => 
                    patient.patientSex === this.filterPatientSex
                );
            }
            
            // Last reported date filter
            if (this.filterLastReported) {
                const filterDate = Array.isArray(this.filterLastReported) ? this.filterLastReported : [this.filterLastReported];
                if (filterDate.length >= 1 && filterDate[0]) {
                    const startDate = new Date(filterDate[0]);
                    startDate.setHours(0, 0, 0, 0);
                    filtered = filtered.filter(patient => {
                        if (!patient.lastDocumentUpload) return false;
                        const reportDate = new Date(patient.lastDocumentUpload);
                        return reportDate >= startDate;
                    });
                }
                if (filterDate.length >= 2 && filterDate[1]) {
                    const endDate = new Date(filterDate[1]);
                    endDate.setHours(23, 59, 59, 999);
                    filtered = filtered.filter(patient => {
                        if (!patient.lastDocumentUpload) return false;
                        const reportDate = new Date(patient.lastDocumentUpload);
                        return reportDate <= endDate;
                    });
                }
            }
            
            this.filteredPatients = filtered;
        },
        parseDicomDate(dateString) {
            if (!dateString) return null;
            if (dateString.length === 8 && !dateString.includes('-')) {
                const year = parseInt(dateString.substring(0, 4));
                const month = parseInt(dateString.substring(4, 6)) - 1;
                const day = parseInt(dateString.substring(6, 8));
                return new Date(year, month, day);
            }
            return new Date(dateString);
        },
        clearFilters() {
            this.filterPatientId = '';
            this.filterPatientName = '';
            this.filterPatientBirthDate = null;
            this.filterPatientSex = '';
            this.filterLastReported = null;
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
            this.$router.push({
                path: '/filtered-studies',
                query: { PatientID: patient.patientId }
            });
        },
        viewWordFiles(patient) {
            this.$router.push({
                path: '/word-files',
                query: { patientId: patient.patientId }
            });
        },
        uploadNewDocument(patient) {
            // Minimal behavior: pick .doc/.docx and upload for this patient (no redirects, no extra steps)
            this.uploadTargetPatient = patient;
            const input = this.$refs.patientDocumentUploadInput;
            if (input) {
                input.value = null; // allow re-uploading the same file
                input.click();
            } else {
                this.messageBus.emit('show-toast', 'Upload input not available');
            }
        },
        async handlePatientDocumentUpload(event) {
            const files = Array.from(event?.target?.files || []);
            const patient = this.uploadTargetPatient;

            if (!patient || files.length === 0) {
                this.uploadTargetPatient = null;
                return;
            }

            const patientId = (patient.patientId || '').trim();
            const patientName = this.formatPatientName(patient.patientName);

            if (!patientId) {
                this.messageBus.emit('show-toast', 'Missing Patient ID');
                this.uploadTargetPatient = null;
                return;
            }

            this.uploadingDocumentPatientId = patient.id;

            let successCount = 0;
            let failedCount = 0;

            for (const file of files) {
                try {
                    const response = await api.uploadWordFile(file, patientId, patientName);
                    if (response && response.success) {
                        successCount++;
                    } else {
                        failedCount++;
                    }
                } catch (error) {
                    failedCount++;
                    console.error('Error uploading document:', error);
                }
            }

            this.uploadingDocumentPatientId = null;
            this.uploadTargetPatient = null;

            if (successCount > 0) {
                this.messageBus.emit('show-toast', `Uploaded ${successCount} document(s)`);
                await this.loadPatients(); // refresh counts/last-upload timestamps
            }
            if (failedCount > 0) {
                this.messageBus.emit('show-toast', `Failed to upload ${failedCount} document(s)`);
            }
        },
        formatDate(dateString) {
            if (!dateString) return '-';
            if (dateString.length === 8 && !dateString.includes('-')) {
                const year = dateString.substring(0, 4);
                const month = dateString.substring(4, 6);
                const day = dateString.substring(6, 8);
                return `${year}-${month}-${day}`;
            }
            if (dateString.includes('T')) {
                const date = new Date(dateString);
                return date.toLocaleDateString();
            }
            return dateString;
        },
        formatDateTime(dateString) {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },
        formatPatientName(name) {
            if (!name) return '-';
            return name.replace(/\^/g, ', ').replace(/\s+/g, ' ').trim();
        }
    }
}
</script>

<template>
    <div class="table-container">
        <table class="table table-sm study-table table-borderless">
            <thead class="sticky-top">
                <tr class="study-column-titles">
                    <th width="22%" class="study-table-title" scope="col">Patient Name</th>
                    <th width="14%" class="study-table-title" scope="col">Patient ID</th>
                    <th width="12%" class="study-table-title" scope="col">Birth Date</th>
                    <th width="8%" class="study-table-title" scope="col">Sex</th>
                    <th width="12%" class="study-table-title" scope="col">Last Reported</th>
                    <th width="10%" class="study-table-title" scope="col">DICOM Studies</th>
                    <th width="10%" class="study-table-title" scope="col">Documents</th>
                </tr>
                <tr class="study-table-filters">
                    <th scope="col">
                        <div class="d-flex align-items-center">
                            <button @click="clearFilters" type="button" class="clear-filter-btn me-1"
                                data-bs-toggle="tooltip" title="Clear filter">
                                <i class="fa-regular fa-circle-xmark"></i>
                            </button>
                            <input type="text" class="form-control study-list-filter" v-model="filterPatientName" placeholder="Search...">
                        </div>
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterPatientId" placeholder="Search...">
                    </th>
                    <th>
                        <Datepicker v-model="filterPatientBirthDate" :enable-time-picker="false" range
                            text-input arrow-navigation hide-input-icon placeholder="Select date">
                        </Datepicker>
                    </th>
                    <th>
                        <select class="form-select study-list-filter" v-model="filterPatientSex">
                            <option v-for="option in sexOptions" :key="option.value" :value="option.value">
                                {{ option.label }}
                            </option>
                        </select>
                    </th>
                    <th>
                        <Datepicker v-model="filterLastReported" :enable-time-picker="false" range
                            text-input arrow-navigation hide-input-icon placeholder="Select date">
                        </Datepicker>
                    </th>
                    <th class="text-left">
                        <!-- Patient count badge -->
                        <div v-if="loading" class="patient-count-badge loading">
                            <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                            Loading...
                        </div>
                        <div v-else-if="filteredPatients.length === 0" class="patient-count-badge empty">
                            0 patients
                        </div>
                        <div v-else class="patient-count-badge">
                            {{ filteredPatients.length }} patient(s)
                        </div>
                    </th>
                    <th></th>
                </tr>
            </thead>
            <tbody v-if="loading">
                <tr>
                    <td colspan="7" class="text-center" style="padding: 60px 20px;">
                        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-3 text-muted">Loading patients...</p>
                    </td>
                </tr>
            </tbody>
            <tbody v-else-if="isEmpty" class="empty-state-tbody">
                <tr class="empty-state-row">
                    <td colspan="7">
                        <div class="empty-state">
                            <div class="empty-state-icon">
                                <i class="bi bi-people"></i>
                            </div>
                            <h5 class="empty-state-title">No Patients Found</h5>
                            <p class="empty-state-text">
                                There are no patients matching your criteria.<br>
                                Try adjusting your filters or upload new studies.
                            </p>
                        </div>
                    </td>
                </tr>
            </tbody>
            <tbody v-for="patient in filteredPatients" :key="patient.id">
                <tr 
                    class="data-row" 
                    :class="{ 'data-row-expanded': isExpanded(patient.id) }"
                    @click="toggleExpand(patient.id)"
                    style="cursor: pointer;"
                >
                    <td class="cut-text" data-bs-toggle="tooltip" :title="formatPatientName(patient.patientName)">
                        <i class="bi bi-person-circle me-2 patient-icon"></i>
                        {{ formatPatientName(patient.patientName) }}
                    </td>
                    <td class="cut-text" data-bs-toggle="tooltip" :title="patient.patientId">
                        {{ patient.patientId }}
                    </td>
                    <td class="cut-text">
                        {{ formatDate(patient.patientBirthDate) }}
                    </td>
                    <td class="cut-text">
                        {{ patient.patientSex || '-' }}
                    </td>
                    <td class="cut-text">
                        {{ formatDateTime(patient.lastDocumentUpload) }}
                    </td>
                    <td class="text-left">
                        <span class="count-value dicom">{{ patient.dicomStudyCount || 0 }}</span>
                    </td>
                    <td class="text-left">
                        <span class="count-value document">{{ patient.wordFileCount || 0 }}</span>
                    </td>
                </tr>
                <!-- Expanded row with details -->
                <tr v-if="isExpanded(patient.id)" class="details-row">
                    <td colspan="7">
                        <div class="details-content">
                            <div class="details-grid">
                                <div class="info-section">
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
                                    <div class="info-row">
                                        <span class="info-label">Last Document:</span>
                                        <span class="info-value">{{ formatDateTime(patient.lastDocumentUpload) }}</span>
                                    </div>
                                </div>
                                <div class="actions-section">
                                    <h6><i class="bi bi-folder2-open me-2"></i>Patient Actions</h6>
                                    <div class="action-buttons">
                                        <button 
                                            class="btn btn-outline-primary action-btn"
                                            @click.stop="viewDicomFiles(patient)"
                                            :disabled="patient.dicomStudyCount === 0"
                                        >
                                            <i class="bi bi-file-earmark-medical me-2"></i>
                                            View DICOM Studies ({{ patient.dicomStudyCount || 0 }})
                                        </button>
                                        <button 
                                            class="btn btn-outline-secondary action-btn"
                                            @click.stop="viewWordFiles(patient)"
                                            :disabled="patient.wordFileCount === 0"
                                        >
                                            <i class="bi bi-file-earmark-word me-2"></i>
                                            View Documents ({{ patient.wordFileCount || 0 }})
                                        </button>
                                        <button 
                                            class="btn btn-outline-success action-btn"
                                            @click.stop="uploadNewDocument(patient)"
                                            :disabled="uploadingDocumentPatientId === patient.id"
                                        >
                                            <span v-if="uploadingDocumentPatientId === patient.id" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            <i v-else class="bi bi-file-earmark-plus me-2"></i>
                                            Upload New Document
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
        <input
            ref="patientDocumentUploadInput"
            type="file"
            style="display: none;"
            multiple
            accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            @change="handlePatientDocumentUpload"
        />
        <Toasts />
    </div>
</template>

<style scoped>
.table-container {
    position: relative;
}

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
    padding-left: 10px;
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
    padding: 4px;
}

.study-table td {
    text-align: left;
    padding-left: 10px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    vertical-align: middle;
}

/* Patient icon */
.patient-icon {
    color: #6c757d;
    font-size: 14px;
}

/* Count values styling */
.count-value {
    font-weight: 500;
    font-size: 13px;
}

.count-value.dicom {
    color: #0d6efd;
}

.count-value.document {
    color: #6c757d;
}

/* Clear filter button - fixed size */
.clear-filter-btn {
    width: 36px;
    height: 36px;
    min-width: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--bs-border-color);
    border-radius: 6px;
    background-color: var(--bs-body-bg);
    color: var(--bs-body-color);
    cursor: pointer;
    transition: all 0.2s;
}

.clear-filter-btn:hover {
    background-color: var(--bs-light);
}

.clear-filter-btn i {
    font-size: 14px;
}

input.form-control.study-list-filter,
select.form-select.study-list-filter {
    margin-top: var(--filter-margin, 5px);
    margin-bottom: var(--filter-margin, 5px);
    padding-top: var(--filter-padding, 2px);
    padding-bottom: var(--filter-padding, 2px);
    padding-left: 8px;
    padding-right: 8px;
    border-bottom-width: thin;
    font-size: 13px;
    height: 36px;
}

/* Patient count badge */
.patient-count-badge {
    display: inline-flex;
    align-items: center;
    font-size: 12px;
    font-weight: 500;
    color: var(--bs-secondary-color);
}

.patient-count-badge.loading {
    color: #6c757d;
}

.patient-count-badge.empty {
    color: #856404;
}

.cut-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Empty state styles */
.empty-state-tbody tr.empty-state-row:hover,
.empty-state-tbody tr.empty-state-row:hover > td {
    background-color: transparent !important;
    cursor: default;
}

.empty-state {
    text-align: center;
    padding: 60px 20px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 12px;
    margin: 20px;
}

.empty-state-icon {
    font-size: 64px;
    color: #adb5bd;
    margin-bottom: 20px;
}

.empty-state-title {
    font-size: 20px;
    font-weight: 600;
    color: #495057;
    margin-bottom: 10px;
}

.empty-state-text {
    font-size: 14px;
    color: #6c757d;
    max-width: 400px;
    margin: 0 auto;
    line-height: 1.6;
}

/* Data row styles */
.data-row {
    border-top-width: 1px;
    border-color: #ddd;
    transition: background-color 0.2s;
}

.data-row-expanded {
    background-color: var(--study-details-bg-color) !important;
    font-weight: 600;
}

.data-row-expanded > td {
    background-color: var(--study-details-bg-color) !important;
}

.details-row {
    background-color: var(--study-details-bg-color) !important;
}

.details-row > td {
    background-color: var(--study-details-bg-color) !important;
    padding: 0 !important;
}

.details-content {
    padding: 20px;
    background-color: var(--study-details-bg-color);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
}

.info-section h6,
.actions-section h6 {
    margin-bottom: 15px;
    color: var(--bs-body-color);
    font-weight: 600;
    font-size: 14px;
}

.info-row {
    display: flex;
    margin-bottom: 8px;
    font-size: 13px;
}

.info-label {
    font-weight: 500;
    color: var(--bs-secondary-color);
    min-width: 120px;
}

.info-value {
    color: var(--bs-body-color);
    font-weight: 400;
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
    font-size: 13px;
}

.action-btn:hover:not(:disabled) {
    transform: translateX(5px);
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

@media (max-width: 768px) {
    .details-grid {
        grid-template-columns: 1fr;
    }
}
</style>
