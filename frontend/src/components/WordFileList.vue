<script>
import Toasts from "./Toasts.vue"
import api from "../orthancApi"

export default {
    name: 'WordFileList',
    components: { Toasts },
    data() {
        return {
            wordFiles: [],
            filteredWordFiles: [],
            loading: false,
            selectedWordFileIds: [],
            allSelected: false,
            isPartialSelected: false,
            expandedWordFileId: null,
            // Search filters
            filterFileName: '',
            filterPatientId: '',
            filterPatientName: '',
            filterUploadedBy: '',
            filterUploadedAt: null,
            // Document viewer modal
            showDocumentViewer: false,
            viewingDocument: null,
            documentViewerUrl: null,
            documentViewerLoading: false
        };
    },
    async created() {
        // Check for query params
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('patientId')) {
            this.filterPatientId = urlParams.get('patientId');
        }
        await this.loadWordFiles();
    },
    watch: {
        selectedWordFileIds: {
            handler() {
                this.updateSelectAll();
            },
            deep: true
        },
        filterFileName() {
            this.applyFilters();
        },
        filterPatientId() {
            this.applyFilters();
        },
        filterPatientName() {
            this.applyFilters();
        },
        filterUploadedBy() {
            this.applyFilters();
        },
        filterUploadedAt() {
            this.applyFilters();
        },
        wordFiles() {
            this.applyFilters();
        }
    },
    computed: {
        hasSelection() {
            return this.selectedWordFileIds.length > 0;
        },
        isEmpty() {
            return !this.loading && this.filteredWordFiles.length === 0;
        }
    },
    methods: {
        async loadWordFiles() {
            this.loading = true;
            try {
                const response = await api.getWordFiles();
                if (response.success) {
                    this.wordFiles = response.wordFiles || [];
                    this.applyFilters();
                }
            } catch (error) {
                console.error('Error loading word files:', error);
                this.messageBus.emit('show-toast', 'Failed to load Word files');
            } finally {
                this.loading = false;
            }
        },
        applyFilters() {
            let filtered = [...this.wordFiles];
            
            if (this.filterFileName.trim()) {
                const search = this.filterFileName.toLowerCase();
                filtered = filtered.filter(file => 
                    file.originalFileName.toLowerCase().includes(search)
                );
            }
            
            if (this.filterPatientId.trim()) {
                const search = this.filterPatientId.toLowerCase();
                filtered = filtered.filter(file => 
                    file.patientId.toLowerCase().includes(search)
                );
            }
            
            if (this.filterPatientName.trim()) {
                const search = this.filterPatientName.toLowerCase();
                filtered = filtered.filter(file => 
                    file.patientName.toLowerCase().includes(search)
                );
            }
            
            if (this.filterUploadedBy.trim()) {
                const search = this.filterUploadedBy.toLowerCase();
                filtered = filtered.filter(file => 
                    file.uploadedByName.toLowerCase().includes(search)
                );
            }
            
            // Date filter
            if (this.filterUploadedAt) {
                const filterDate = Array.isArray(this.filterUploadedAt) ? this.filterUploadedAt : [this.filterUploadedAt];
                if (filterDate.length >= 1 && filterDate[0]) {
                    const startDate = new Date(filterDate[0]);
                    startDate.setHours(0, 0, 0, 0);
                    filtered = filtered.filter(file => {
                        const fileDate = new Date(file.uploadedAt);
                        return fileDate >= startDate;
                    });
                }
                if (filterDate.length >= 2 && filterDate[1]) {
                    const endDate = new Date(filterDate[1]);
                    endDate.setHours(23, 59, 59, 999);
                    filtered = filtered.filter(file => {
                        const fileDate = new Date(file.uploadedAt);
                        return fileDate <= endDate;
                    });
                }
            }
            
            this.filteredWordFiles = filtered;
            this.updateSelectAll();
        },
        clearFilters() {
            this.filterFileName = '';
            this.filterPatientId = '';
            this.filterPatientName = '';
            this.filterUploadedBy = '';
            this.filterUploadedAt = null;
        },
        toggleExpand(id) {
            if (this.expandedWordFileId === id) {
                this.expandedWordFileId = null;
            } else {
                this.expandedWordFileId = id;
            }
        },
        isExpanded(id) {
            return this.expandedWordFileId === id;
        },
        async deleteWordFile(id) {
            if (!confirm('Are you sure you want to delete this document?')) {
                return;
            }
            
            try {
                await api.deleteWordFile(id);
                this.wordFiles = this.wordFiles.filter(file => file.id !== id);
                if (this.expandedWordFileId === id) {
                    this.expandedWordFileId = null;
                }
                this.messageBus.emit('show-toast', 'Document deleted successfully');
            } catch (error) {
                console.error('Error deleting word file:', error);
                this.messageBus.emit('show-toast', 'Failed to delete document');
            }
        },
        async deleteSelectedWordFiles() {
            if (this.selectedWordFileIds.length === 0) {
                return;
            }
            
            if (!confirm(`Are you sure you want to delete ${this.selectedWordFileIds.length} selected document(s)?`)) {
                return;
            }
            
            try {
                for (const id of this.selectedWordFileIds) {
                    await api.deleteWordFile(id);
                }
                this.wordFiles = this.wordFiles.filter(file => !this.selectedWordFileIds.includes(file.id));
                this.selectedWordFileIds = [];
                this.expandedWordFileId = null;
                this.messageBus.emit('show-toast', 'Selected documents deleted successfully');
            } catch (error) {
                console.error('Error deleting word files:', error);
                this.messageBus.emit('show-toast', 'Failed to delete some documents');
            }
        },
        async viewWordFile(id) {
            try {
                this.viewingDocument = this.wordFiles.find(f => f.id === id);
                this.documentViewerLoading = true;
                this.showDocumentViewer = true;
                
                const response = await api.downloadWordFile(id);
                const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                this.documentViewerUrl = window.URL.createObjectURL(blob);
                this.documentViewerLoading = false;
            } catch (error) {
                console.error('Error viewing word file:', error);
                this.messageBus.emit('show-toast', 'Failed to view document');
                this.closeDocumentViewer();
            }
        },
        closeDocumentViewer() {
            this.showDocumentViewer = false;
            this.viewingDocument = null;
            if (this.documentViewerUrl) {
                window.URL.revokeObjectURL(this.documentViewerUrl);
                this.documentViewerUrl = null;
            }
            this.documentViewerLoading = false;
        },
        downloadViewingDocument() {
            if (this.viewingDocument) {
                this.downloadWordFile(this.viewingDocument.id);
            }
        },
        async downloadWordFile(id) {
            try {
                const response = await api.downloadWordFile(id);
                const file = this.wordFiles.find(f => f.id === id);
                const blob = new Blob([response.data]);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.originalFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Error downloading word file:', error);
                this.messageBus.emit('show-toast', 'Failed to download document');
            }
        },
        async downloadSelectedWordFiles() {
            if (this.selectedWordFileIds.length === 0) {
                return;
            }
            
            try {
                for (const id of this.selectedWordFileIds) {
                    await this.downloadWordFile(id);
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                this.messageBus.emit('show-toast', 'Download started for selected documents');
            } catch (error) {
                console.error('Error downloading word files:', error);
                this.messageBus.emit('show-toast', 'Failed to download some documents');
            }
        },
        async printWordFile(id) {
            try {
                const response = await api.downloadWordFile(id);
                const blob = new Blob([response.data]);
                const url = window.URL.createObjectURL(blob);
                const printWindow = window.open(url, '_blank');
                printWindow.onload = () => {
                    printWindow.print();
                };
            } catch (error) {
                console.error('Error printing word file:', error);
                this.messageBus.emit('show-toast', 'Failed to print document');
            }
        },
        async printSelectedWordFiles() {
            if (this.selectedWordFileIds.length === 0) {
                return;
            }
            
            try {
                for (const id of this.selectedWordFileIds) {
                    await this.printWordFile(id);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('Error printing word files:', error);
                this.messageBus.emit('show-toast', 'Failed to print some documents');
            }
        },
        updateSelectAll() {
            if (this.selectedWordFileIds.length == 0) {
                this.allSelected = false;
                this.isPartialSelected = false;
            } else if (this.selectedWordFileIds.length == this.filteredWordFiles.length) {
                this.allSelected = true;
                this.isPartialSelected = false;
            } else {
                this.allSelected = '';
                this.isPartialSelected = true;
            }
        },
        clickSelectAll() {
            if (this.allSelected == '' || !this.allSelected) {
                this.selectedWordFileIds = this.filteredWordFiles.map(f => f.id);
            } else {
                this.selectedWordFileIds = [];
            }
            this.updateSelectAll();
        },
        onWordFileSelected(id, isSelected) {
            if (isSelected) {
                if (!this.selectedWordFileIds.includes(id)) {
                    this.selectedWordFileIds.push(id);
                }
            } else {
                this.selectedWordFileIds = this.selectedWordFileIds.filter(selectedId => selectedId !== id);
            }
            this.updateSelectAll();
        },
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        },
        formatFileSize(bytes) {
            if (!bytes) return '-';
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        },
        getWordFile(id) {
            return this.wordFiles.find(f => f.id === id);
        }
    }
}
</script>

<template>
    <div class="table-container">
        <table class="table table-sm study-table table-borderless">
            <thead class="sticky-top">
                <tr class="study-column-titles">
                    <th width="3%" scope="col"></th>
                    <th width="28%" class="study-table-title" scope="col">File Name</th>
                    <th width="12%" class="study-table-title" scope="col">Patient ID</th>
                    <th width="18%" class="study-table-title" scope="col">Patient Name</th>
                    <th width="12%" class="study-table-title" scope="col">Uploaded By</th>
                    <th width="15%" class="study-table-title" scope="col">Uploaded At</th>
                    <th width="7%" class="study-table-title" scope="col">Delete</th>
                </tr>
                <tr class="study-table-filters">
                    <th scope="col">
                        <button @click="clearFilters" type="button" class="clear-filter-btn"
                            data-bs-toggle="tooltip" title="Clear filter">
                            <i class="fa-regular fa-circle-xmark"></i>
                        </button>
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterFileName" placeholder="Search...">
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterPatientId" placeholder="Search...">
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterPatientName" placeholder="Search...">
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterUploadedBy" placeholder="Search...">
                    </th>
                    <th>
                        <Datepicker v-model="filterUploadedAt" :enable-time-picker="false" range
                            text-input arrow-navigation hide-input-icon placeholder="Select date range">
                        </Datepicker>
                    </th>
                    <th></th>
                </tr>
                <tr class="study-table-actions">
                    <th width="3%" scope="col">
                        <div class="form-check" style="margin-left: 0.5rem">
                            <input class="form-check-input" type="checkbox" v-model="allSelected"
                                :indeterminate="isPartialSelected" @click="clickSelectAll">
                            <span style="font-weight: 400; font-size: small;">{{ selectedWordFileIds.length }}</span>
                        </div>
                    </th>
                    <th width="97%" colspan="6" scope="col">
                        <div class="container px-0">
                            <div class="row g-1">
                                <div class="col-6 study-list-bulk-buttons">
                                    <button class="btn btn-sm btn-secondary m-1" @click="downloadSelectedWordFiles" 
                                        :disabled="!hasSelection" title="Download">
                                        <i class="bi bi-download"></i> Download
                                    </button>
                                    <button class="btn btn-sm btn-secondary m-1" @click="printSelectedWordFiles" 
                                        :disabled="!hasSelection" title="Print">
                                        <i class="bi bi-printer"></i> Print
                                    </button>
                                    <button class="btn btn-sm btn-danger m-1" @click="deleteSelectedWordFiles" 
                                        :disabled="!hasSelection" title="Delete">
                                        <i class="bi bi-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody v-if="loading">
                <tr>
                    <td colspan="7" class="text-center" style="padding: 60px 20px;">
                        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-3 text-muted">Loading documents...</p>
                    </td>
                </tr>
            </tbody>
            <tbody v-else-if="isEmpty" class="empty-state-tbody">
                <tr class="empty-state-row">
                    <td colspan="7">
                        <div class="empty-state">
                            <div class="empty-state-icon">
                                <i class="bi bi-file-earmark-x"></i>
                            </div>
                            <h5 class="empty-state-title">No Documents Found</h5>
                            <p class="empty-state-text">
                                There are no documents matching your criteria.<br>
                                Try adjusting your filters or upload new documents.
                            </p>
                        </div>
                    </td>
                </tr>
            </tbody>
            <tbody v-for="wordFile in filteredWordFiles" :key="wordFile.id">
                <tr 
                    class="data-row" 
                    :class="{ 'data-row-expanded': isExpanded(wordFile.id) }"
                >
                    <td style="vertical-align: middle; padding-right: 8px;">
                        <div class="form-check" style="display: flex; align-items: center; justify-content: center; height: 100%;">
                            <input 
                                class="form-check-input" 
                                type="checkbox" 
                                :checked="selectedWordFileIds.includes(wordFile.id)" 
                                @change="onWordFileSelected(wordFile.id, $event.target.checked)"
                                @click.stop
                                style="margin: 0;"
                            >
                        </div>
                    </td>
                    <td class="cut-text" data-bs-toggle="tooltip" :title="wordFile.originalFileName" @click="toggleExpand(wordFile.id)" style="cursor: pointer;">
                        {{ wordFile.originalFileName }}
                    </td>
                    <td class="cut-text" data-bs-toggle="tooltip" :title="wordFile.patientId" @click="toggleExpand(wordFile.id)" style="cursor: pointer;">
                        {{ wordFile.patientId }}
                    </td>
                    <td class="cut-text" data-bs-toggle="tooltip" :title="wordFile.patientName" @click="toggleExpand(wordFile.id)" style="cursor: pointer;">
                        {{ wordFile.patientName }}
                    </td>
                    <td class="cut-text" data-bs-toggle="tooltip" :title="wordFile.uploadedByName" @click="toggleExpand(wordFile.id)" style="cursor: pointer;">
                        {{ wordFile.uploadedByName }}
                    </td>
                    <td class="cut-text" data-bs-toggle="tooltip" :title="formatDate(wordFile.uploadedAt)" @click="toggleExpand(wordFile.id)" style="cursor: pointer;">
                        {{ formatDate(wordFile.uploadedAt) }}
                    </td>
                    <td class="text-center">
                        <button 
                            type="button" 
                            class="btn btn-sm btn-danger" 
                            @click.stop="deleteWordFile(wordFile.id)"
                            title="Delete"
                        >
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
                <!-- Expanded row with details -->
                <tr v-if="isExpanded(wordFile.id)" class="details-row">
                    <td colspan="7">
                        <div class="details-content">
                            <div class="details-grid">
                                <!-- Document Preview -->
                                <div class="preview-section">
                                    <div class="preview-placeholder">
                                        <i class="bi bi-file-earmark-word"></i>
                                        <span>{{ wordFile.originalFileName }}</span>
                                    </div>
                                </div>
                                
                                <!-- Patient Info -->
                                <div class="info-section">
                                    <h6><i class="bi bi-person-fill me-2"></i>Patient Information</h6>
                                    <div class="info-row">
                                        <span class="info-label">Patient ID:</span>
                                        <span class="info-value">{{ wordFile.patientId }}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">Patient Name:</span>
                                        <span class="info-value">{{ wordFile.patientName }}</span>
                                    </div>
                                </div>
                                
                                <!-- Upload Info -->
                                <div class="info-section">
                                    <h6><i class="bi bi-cloud-upload me-2"></i>Upload Information</h6>
                                    <div class="info-row">
                                        <span class="info-label">Uploaded User:</span>
                                        <span class="info-value">{{ wordFile.uploadedByName }}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">Uploaded Date:</span>
                                        <span class="info-value">{{ formatDate(wordFile.uploadedAt) }}</span>
                                    </div>
                                    <div class="info-row">
                                        <span class="info-label">File Size:</span>
                                        <span class="info-value">{{ formatFileSize(wordFile.fileSize) }}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Actions -->
                            <div class="actions-section">
                                <span class="actions-label">Actions:</span>
                                <div class="action-buttons">
                                    <button 
                                        type="button" 
                                        class="btn btn-sm btn-secondary action-btn"
                                        @click="viewWordFile(wordFile.id)"
                                        title="View"
                                    >
                                        <i class="bi bi-eye"></i>
                                    </button>
                                    <button 
                                        type="button" 
                                        class="btn btn-sm btn-secondary action-btn"
                                        @click="downloadWordFile(wordFile.id)"
                                        title="Download"
                                    >
                                        <i class="bi bi-download"></i>
                                    </button>
                                    <button 
                                        type="button" 
                                        class="btn btn-sm btn-secondary action-btn"
                                        @click="printWordFile(wordFile.id)"
                                        title="Print"
                                    >
                                        <i class="bi bi-printer"></i>
                                    </button>
                                    <button 
                                        type="button" 
                                        class="btn btn-sm btn-danger action-btn"
                                        @click="deleteWordFile(wordFile.id)"
                                        title="Delete"
                                    >
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
        <Toasts />
        
        <!-- Document Viewer Modal -->
        <div v-if="showDocumentViewer" class="document-viewer-overlay" @click.self="closeDocumentViewer">
            <div class="document-viewer-modal">
                <div class="document-viewer-header">
                    <h5>{{ viewingDocument?.originalFileName }}</h5>
                    <div class="document-viewer-actions">
                        <button class="btn btn-sm btn-outline-primary me-2" @click="downloadViewingDocument">
                            <i class="bi bi-download me-1"></i> Download
                        </button>
                        <button class="btn-close" @click="closeDocumentViewer"></button>
                    </div>
                </div>
                <div class="document-viewer-body">
                    <div v-if="documentViewerLoading" class="document-viewer-loading">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p>Loading document...</p>
                    </div>
                    <div v-else-if="documentViewerUrl" class="document-viewer-content">
                        <div class="document-info-banner">
                            <i class="bi bi-info-circle me-2"></i>
                            Word documents cannot be previewed directly in the browser. Please download the file to view its contents.
                        </div>
                        <div class="document-preview-placeholder">
                            <i class="bi bi-file-earmark-word"></i>
                            <h4>{{ viewingDocument?.originalFileName }}</h4>
                            <p class="text-muted">
                                Patient: {{ viewingDocument?.patientName }} ({{ viewingDocument?.patientId }})<br>
                                Uploaded: {{ formatDate(viewingDocument?.uploadedAt) }}
                            </p>
                            <button class="btn btn-primary" @click="downloadViewingDocument">
                                <i class="bi bi-download me-2"></i>Download to View
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
    padding: 4px;
}

.study-table-actions {
    background-color: var(--study-table-actions-bg-color) !important;
}

.study-table-actions > th {
    background-color: var(--study-table-actions-bg-color) !important;
    vertical-align: middle;
}

.study-table-actions > th > div {
    background-color: var(--study-table-actions-bg-color) !important;
    text-align: left;
}

.study-table td {
    text-align: left;
    padding-left: 10px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    vertical-align: middle;
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

input.form-control.study-list-filter {
    margin-top: var(--filter-margin, 5px);
    margin-bottom: var(--filter-margin, 5px);
    padding-top: var(--filter-padding, 2px);
    padding-bottom: var(--filter-padding, 2px);
    padding-left: 8px;
    padding-right: 8px;
    border-bottom-width: thin;
    font-size: 13px;
}

.study-list-bulk-buttons {
    margin-top: var(--filter-margin, 5px);
}

.study-list-bulk-buttons .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    grid-template-columns: 150px 1fr 1fr;
    gap: 30px;
    margin-bottom: 20px;
}

.preview-section {
    display: flex;
    justify-content: center;
    align-items: center;
}

.preview-placeholder {
    width: 120px;
    height: 150px;
    border: 2px solid #ddd;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #f8f9fa;
    color: #6c757d;
}

.preview-placeholder i {
    font-size: 48px;
    margin-bottom: 10px;
    color: #2b579a;
}

.preview-placeholder span {
    font-size: 10px;
    text-align: center;
    padding: 0 5px;
    word-break: break-all;
    font-weight: 400;
}

.info-section h6 {
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

.actions-section {
    display: flex;
    align-items: center;
    padding-top: 15px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.actions-label {
    font-weight: 600;
    margin-right: 20px;
    color: var(--bs-body-color);
    font-size: 14px;
}

.action-buttons {
    display: flex;
    gap: 10px;
}

.action-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.2s;
}

.action-btn:hover {
    transform: scale(1.1);
}

.action-btn i {
    font-size: 16px;
}

@media (max-width: 768px) {
    .details-grid {
        grid-template-columns: 1fr;
    }
    
    .preview-section {
        display: none;
    }
}

/* Document Viewer Modal */
.document-viewer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.document-viewer-modal {
    background: white;
    border-radius: 12px;
    width: 80%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.document-viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid #e0e0e0;
}

.document-viewer-header h5 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--bs-body-color);
}

.document-viewer-actions {
    display: flex;
    align-items: center;
}

.document-viewer-body {
    flex: 1;
    overflow: auto;
    padding: 24px;
}

.document-viewer-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px;
}

.document-viewer-loading p {
    margin-top: 16px;
    color: var(--bs-secondary-color);
}

.document-viewer-content {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.document-info-banner {
    width: 100%;
    padding: 12px 16px;
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 8px;
    color: #856404;
    margin-bottom: 24px;
    font-size: 13px;
}

.document-preview-placeholder {
    text-align: center;
    padding: 40px;
    background: #f8f9fa;
    border-radius: 12px;
    width: 100%;
}

.document-preview-placeholder i {
    font-size: 80px;
    color: #2b579a;
    margin-bottom: 16px;
}

.document-preview-placeholder h4 {
    font-size: 18px;
    font-weight: 600;
    color: var(--bs-body-color);
    margin-bottom: 12px;
}
</style>
