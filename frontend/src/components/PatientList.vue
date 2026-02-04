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
            filterLastReported: null,
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                pages: 0
            }
        };
    },
    async created() {
        await this.loadPatients();
    },
    watch: {
        filterPatientId() {
            this.pagination.page = 1;
            this.loadPatients();
        },
        filterPatientName() {
            this.pagination.page = 1;
            this.loadPatients();
        },
        filterPatientBirthDate() {
            this.pagination.page = 1;
            this.loadPatients();
        },
        filterPatientSex() {
            this.pagination.page = 1;
            this.loadPatients();
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
            return !this.loading && this.pagination.total === 0;
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
        buildPatientParams() {
            const range = Array.isArray(this.filterPatientBirthDate) ? this.filterPatientBirthDate : (this.filterPatientBirthDate ? [this.filterPatientBirthDate] : []);
            let birthDateFrom, birthDateTo;
            if (range.length >= 1 && range[0]) birthDateFrom = new Date(range[0]).toISOString().slice(0, 10);
            if (range.length >= 2 && range[1]) birthDateTo = new Date(range[1]).toISOString().slice(0, 10);
            return {
                page: this.pagination.page,
                limit: this.pagination.limit,
                patientId: this.filterPatientId.trim() || undefined,
                patientName: this.filterPatientName.trim() || undefined,
                patientSex: this.filterPatientSex || undefined,
                birthDateFrom,
                birthDateTo
            };
        },
        async loadPatients() {
            this.loading = true;
            try {
                const params = this.buildPatientParams();
                const response = await api.getPatients(params);
                if (response.success) {
                    this.patients = response.patients || [];
                    if (response.pagination) {
                        this.pagination = { ...this.pagination, ...response.pagination };
                    }
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
            // Client-side filter only for lastReported (server doesn't have this field)
            let filtered = [...this.patients];
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
        goToPage(page) {
            if (page < 1 || page > this.pagination.pages) return;
            this.pagination.page = page;
            this.loadPatients();
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
                query: { PatientID: '*' + patient.patientId + '*' }
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
    <div class="patients-page">
        <div class="table-wrapper">
        <table class="table table-sm patient-table table-borderless">
            <thead class="sticky-top">
                <tr class="patient-column-titles">
                    <th width="22%" class="patient-table-title" scope="col">Patient Name</th>
                    <th width="14%" class="patient-table-title" scope="col">Patient ID</th>
                    <th width="12%" class="patient-table-title" scope="col">Birth Date</th>
                    <th width="8%" class="patient-table-title" scope="col">Sex</th>
                    <th width="12%" class="patient-table-title" scope="col">Last Reported</th>
                    <th width="10%" class="patient-table-title" scope="col">DICOM</th>
                    <th width="10%" class="patient-table-title" scope="col">Documents</th>
                </tr>
                <tr class="patient-table-filters">
                    <th scope="col">
                        <div class="filter-with-clear">
                            <button @click="clearFilters" type="button" class="clear-filter-btn"
                                data-bs-toggle="tooltip" title="Clear all filters">
                                <i class="fa-regular fa-circle-xmark"></i>
                            </button>
                            <input type="text" class="form-control patient-filter" v-model="filterPatientName" placeholder="Search name...">
                        </div>
                    </th>
                    <th>
                        <input type="text" class="form-control patient-filter" v-model="filterPatientId" placeholder="Search ID...">
                    </th>
                    <th>
                        <Datepicker v-model="filterPatientBirthDate" :enable-time-picker="false" range
                            text-input arrow-navigation hide-input-icon placeholder="Birth date">
                        </Datepicker>
                    </th>
                    <th>
                        <select class="form-select patient-filter" v-model="filterPatientSex">
                            <option v-for="option in sexOptions" :key="option.value" :value="option.value">
                                {{ option.label }}
                            </option>
                        </select>
                    </th>
                    <th>
                        <Datepicker v-model="filterLastReported" :enable-time-picker="false" range
                            text-input arrow-navigation hide-input-icon placeholder="Last reported">
                        </Datepicker>
                    </th>
                    <th class="text-center">
                        <div v-if="loading" class="patient-count-badge loading">
                            <span class="spinner-border spinner-border-sm" role="status"></span>
                        </div>
                        <div v-else class="patient-count-badge">
                            {{ pagination.total }}
                        </div>
                    </th>
                    <th></th>
                </tr>
            </thead>
            <tbody v-if="loading">
                <tr>
                    <td colspan="7" class="text-center" style="padding: 80px 20px;">
                        <div class="loading-spinner">
                            <div class="spinner-border" role="status" style="width: 2.5rem; height: 2.5rem; color: #4a90e2;"></div>
                        </div>
                        <p class="loading-text">Loading patients...</p>
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
                    class="patient-row" 
                    :class="{ 'patient-row-expanded': isExpanded(patient.id) }"
                    @click="toggleExpand(patient.id)"
                >
                    <td class="cut-text" data-bs-toggle="tooltip" :title="formatPatientName(patient.patientName)">
                        <div class="patient-name-cell">
                            <div class="patient-avatar">
                                <i class="bi bi-person-fill"></i>
                            </div>
                            <span class="patient-name">{{ formatPatientName(patient.patientName) }}</span>
                        </div>
                    </td>
                    <td class="cut-text patient-id-cell" data-bs-toggle="tooltip" :title="patient.patientId">
                        {{ patient.patientId }}
                    </td>
                    <td class="cut-text">
                        {{ formatDate(patient.patientBirthDate) }}
                    </td>
                    <td class="cut-text">
                        <span class="sex-badge" :class="patient.patientSex === 'M' ? 'male' : patient.patientSex === 'F' ? 'female' : 'other'">
                            {{ patient.patientSex || '-' }}
                        </span>
                    </td>
                    <td class="cut-text">
                        {{ formatDateTime(patient.lastDocumentUpload) }}
                    </td>
                    <td class="text-center">
                        <span class="count-badge dicom" :class="{ 'has-items': patient.dicomStudyCount > 0 }">
                            {{ patient.dicomStudyCount || 0 }}
                        </span>
                    </td>
                    <td class="text-center">
                        <span class="count-badge document" :class="{ 'has-items': patient.wordFileCount > 0 }">
                            {{ patient.wordFileCount || 0 }}
                        </span>
                    </td>
                </tr>
                <!-- Expanded details card -->
                <tr v-if="isExpanded(patient.id)" class="details-row">
                    <td colspan="7">
                        <div class="details-card">
                            <div class="details-main">
                                <div class="patient-info-card">
                                    <div class="patient-avatar-large">
                                        <i class="bi bi-person-fill"></i>
                                    </div>
                                    <div class="patient-meta">
                                        <div class="patient-name-large">{{ formatPatientName(patient.patientName) }}</div>
                                        <div class="patient-id-large">ID: {{ patient.patientId }}</div>
                                    </div>
                                </div>
                                <div class="info-columns">
                                    <div class="info-column">
                                        <div class="info-column-title">Demographics</div>
                                        <div class="info-item">
                                            <span class="info-key">Birth Date</span>
                                            <span class="info-val">{{ formatDate(patient.patientBirthDate) }}</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-key">Sex</span>
                                            <span class="info-val">{{ patient.patientSex || '-' }}</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-key">Other IDs</span>
                                            <span class="info-val">{{ patient.otherPatientIds || '-' }}</span>
                                        </div>
                                    </div>
                                    <div class="info-column">
                                        <div class="info-column-title">Records</div>
                                        <div class="info-item">
                                            <span class="info-key">DICOM</span>
                                            <span class="info-val">{{ patient.dicomStudyCount || 0 }} studies</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-key">Documents</span>
                                            <span class="info-val">{{ patient.wordFileCount || 0 }} files</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-key">Last Upload</span>
                                            <span class="info-val">{{ formatDateTime(patient.lastDocumentUpload) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="actions-bar">
                                <button 
                                    class="action-btn action-dicom"
                                    @click.stop="viewDicomFiles(patient)"
                                    :disabled="patient.dicomStudyCount === 0"
                                >
                                    <i class="bi bi-file-earmark-medical"></i>
                                    DICOM Studies
                                </button>
                                <button 
                                    class="action-btn action-docs"
                                    @click.stop="viewWordFiles(patient)"
                                    :disabled="patient.wordFileCount === 0"
                                >
                                    <i class="bi bi-file-earmark-word"></i>
                                    Documents
                                </button>
                                <button 
                                    class="action-btn action-upload"
                                    @click.stop="uploadNewDocument(patient)"
                                    :disabled="uploadingDocumentPatientId === patient.id"
                                >
                                    <span v-if="uploadingDocumentPatientId === patient.id" class="spinner-border spinner-border-sm" role="status"></span>
                                    <i v-else class="bi bi-upload"></i>
                                    Upload Document
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
        </div>
        <input
            ref="patientDocumentUploadInput"
            type="file"
            style="display: none;"
            multiple
            accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            @change="handlePatientDocumentUpload"
        />
        <!-- Pagination -->
        <div v-if="!loading && pagination.pages > 1" class="pagination-section">
            <button
                class="pagination-btn"
                :disabled="pagination.page <= 1"
                @click="goToPage(pagination.page - 1)"
            >
                <i class="bi bi-chevron-left"></i>
            </button>
            <span class="page-info">
                Page <strong>{{ pagination.page }}</strong> of <strong>{{ pagination.pages }}</strong>
            </span>
            <button
                class="pagination-btn"
                :disabled="pagination.page >= pagination.pages"
                @click="goToPage(pagination.page + 1)"
            >
                <i class="bi bi-chevron-right"></i>
            </button>
        </div>
        <Toasts />
    </div>
</template>

<style>
/* Page Container */
.patients-page {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    padding: 16px;
    background: #f8fafc;
    min-height: calc(100vh - 60px);
}

.table-wrapper {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

/* Table Base */
.patient-table {
    table-layout: auto;
    min-width: 900px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    background: #ffffff;
}

/* Header Titles */
.patient-column-titles {
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    border-bottom: 1px solid #e2e8f0 !important;
}

.patient-table-title {
    text-align: left;
    padding: 14px 12px;
    vertical-align: middle !important;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
}

/* Filter Row */
.patient-table-filters {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
}

.patient-table-filters > th {
    background: #ffffff;
    padding: 8px 12px;
    vertical-align: middle;
}

/* Generic date picker styling - works everywhere */
.dp__input_wrap {
    height: 34px !important;
    display: flex !important;
    align-items: center !important;
}

.dp__input {
    height: 34px !important;
    min-height: 34px !important;
    max-height: 34px !important;
    padding: 6px 10px !important;
    border-radius: 6px !important;
    border: 1px solid #e5e7eb !important;
    font-size: 13px !important;
    transition: all 0.15s ease !important;
    background: #f9fafb !important;
    box-shadow: none !important;
    line-height: 1.5 !important;
    box-sizing: border-box !important;
}

.dp__input:focus {
    border-color: #4a90e2 !important;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.15) !important;
    outline: none !important;
    background: white !important;
}


.filter-with-clear {
    display: flex;
    align-items: center;
    gap: 8px;
}

/* Clear filter button */
.clear-filter-btn {
    width: 32px;
    height: 32px;
    min-width: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #f9fafb;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s ease;
}

.clear-filter-btn:hover {
    background: #fee2e2;
    border-color: #fecaca;
    color: #dc2626;
}

.clear-filter-btn i {
    font-size: 12px;
}

/* Filter inputs */
input.form-control.patient-filter,
select.form-select.patient-filter {
    height: 32px;
    padding: 4px 10px;
    font-size: 13px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #f9fafb;
    transition: all 0.15s ease;
}

input.form-control.patient-filter:focus,
select.form-select.patient-filter:focus {
    border-color: #4a90e2;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.15);
}

/* Patient count badge */
.patient-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 24px;
    padding: 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: #4a90e2;
    background: #e8f4fd;
    border-radius: 12px;
}

.patient-count-badge.loading {
    color: #6b7280;
    background: #f3f4f6;
}

/* Table cells */
.patient-table td {
    text-align: left;
    padding: 14px 12px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    vertical-align: middle;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
}

.cut-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Patient row styles */
.patient-row {
    cursor: pointer;
    transition: all 0.15s ease;
}

.patient-row:hover {
    background: #f8fafc;
}

.patient-row:hover td {
    background: #f8fafc;
}

.patient-row-expanded {
    background: #e8f4fd !important;
}

.patient-row-expanded td {
    background: #e8f4fd !important;
    font-weight: 500;
}

/* Patient name cell */
.patient-name-cell {
    display: flex;
    align-items: center;
    gap: 10px;
}

.patient-avatar {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.patient-avatar i {
    color: #ffffff;
    font-size: 14px;
}

.patient-name {
    font-weight: 500;
    color: #1f2937;
}

.patient-id-cell {
    color: #6b7280;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 12px;
}

/* Sex badge */
.sex-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
}

.sex-badge.male {
    background: #dbeafe;
    color: #1d4ed8;
}

.sex-badge.female {
    background: #fce7f3;
    color: #be185d;
}

.sex-badge.other {
    background: #f3f4f6;
    color: #6b7280;
}

/* Count badges */
.count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 24px;
    padding: 0 8px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
}

.count-badge.dicom {
    background: #f3f4f6;
    color: #6b7280;
}

.count-badge.dicom.has-items {
    background: #dbeafe;
    color: #1d4ed8;
}

.count-badge.document {
    background: #f3f4f6;
    color: #6b7280;
}

.count-badge.document.has-items {
    background: #dcfce7;
    color: #15803d;
}

/* Loading state */
.loading-spinner {
    margin-bottom: 16px;
}

.loading-text {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
}

/* Empty state */
.empty-state-tbody tr.empty-state-row:hover,
.empty-state-tbody tr.empty-state-row:hover > td {
    background-color: transparent !important;
    cursor: default;
}

.empty-state {
    text-align: center;
    padding: 80px 20px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 12px;
    margin: 20px;
}

.empty-state-icon {
    font-size: 56px;
    color: #cbd5e1;
    margin-bottom: 20px;
}

.empty-state-title {
    font-size: 18px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
}

.empty-state-text {
    font-size: 14px;
    color: #6b7280;
    max-width: 360px;
    margin: 0 auto;
    line-height: 1.6;
}

/* Details row */
.details-row > td {
    padding: 0 16px 16px 16px !important;
    background: transparent !important;
}

/* Details card */
.details-card {
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
    border: 1px solid #e5e7eb;
    margin-top: 15px;
    overflow: hidden;
}

.details-main {
    display: flex;
    align-items: stretch;
    gap: 0;
    padding: 20px 24px;
    flex-wrap: wrap;
}

.patient-info-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-right: 28px;
    border-right: 1px solid #e5e7eb;
    min-width: 220px;
}

.patient-avatar-large {
    width: 52px;
    height: 52px;
    background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.patient-avatar-large i {
    font-size: 24px;
    color: #ffffff;
}

.patient-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.patient-name-large {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
}

.patient-id-large {
    font-size: 12px;
    color: #6b7280;
    font-family: 'SF Mono', Monaco, monospace;
}

.info-columns {
    display: flex;
    gap: 40px;
    padding-left: 28px;
    flex: 1;
    flex-wrap: wrap;
}

.info-column {
    min-width: 140px;
}

.info-column-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #9ca3af;
    margin-bottom: 10px;
}

.info-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 13px;
}

.info-key {
    color: #6b7280;
    font-weight: 500;
    min-width: 70px;
}

.info-val {
    color: #1f2937;
    font-weight: 500;
}

/* Actions bar */
.actions-bar {
    display: flex;
    gap: 8px;
    padding: 14px 24px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    flex-wrap: wrap;
}

.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.action-dicom {
    background: #dbeafe;
    color: #1d4ed8;
}

.action-dicom:hover:not(:disabled) {
    background: #bfdbfe;
}

.action-docs {
    background: #e8f4fd;
    color: #2563eb;
}

.action-docs:hover:not(:disabled) {
    background: #d1e9fa;
}

.action-upload {
    background: #dcfce7;
    color: #15803d;
}

.action-upload:hover:not(:disabled) {
    background: #bbf7d0;
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Pagination */
.pagination-section {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    margin-top: 8px;
}

.pagination-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #ffffff;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
}

.pagination-btn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #d1d5db;
}

.pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.page-info {
    font-size: 14px;
    color: #6b7280;
}

.page-info strong {
    color: #1f2937;
}

/* Responsive */
@media (max-width: 768px) {
    .details-main {
        flex-direction: column;
        gap: 16px;
    }
    
    .patient-info-card {
        border-right: none;
        border-bottom: 1px solid #e5e7eb;
        padding-right: 0;
        padding-bottom: 16px;
        min-width: auto;
    }
    
    .info-columns {
        padding-left: 0;
        gap: 20px;
    }
    
    .actions-bar {
        justify-content: center;
    }
}
</style>
