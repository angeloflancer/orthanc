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
            filterUploadedBy: ''
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
        wordFiles() {
            this.applyFilters();
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
            
            this.filteredWordFiles = filtered;
            this.updateSelectAll();
        },
        clearFilters() {
            this.filterFileName = '';
            this.filterPatientId = '';
            this.filterPatientName = '';
            this.filterUploadedBy = '';
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
                const response = await api.downloadWordFile(id);
                const blob = new Blob([response.data]);
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
            } catch (error) {
                console.error('Error viewing word file:', error);
                this.messageBus.emit('show-toast', 'Failed to view document');
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
    <div>
        <table class="table table-sm study-table table-borderless">
            <thead class="sticky-top">
                <tr class="study-column-titles">
                    <th width="3%" scope="col"></th>
                    <th width="30%" class="study-table-title" scope="col">File Name</th>
                    <th width="15%" class="study-table-title" scope="col">Patient ID</th>
                    <th width="20%" class="study-table-title" scope="col">Patient Name</th>
                    <th width="15%" class="study-table-title" scope="col">Uploaded By</th>
                    <th width="12%" class="study-table-title" scope="col">Uploaded At</th>
                    <th width="5%" class="study-table-title" scope="col">Delete</th>
                </tr>
                <tr class="study-table-filters">
                    <th scope="col">
                        <button @click="clearFilters" type="button" class="form-control study-list-filter btn filter-button btn-sm"
                            data-bs-toggle="tooltip" title="Clear filter">
                            <i class="fa-regular fa-circle-xmark"></i>
                        </button>
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterFileName" placeholder="Search file name...">
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterPatientId" placeholder="Search patient ID...">
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterPatientName" placeholder="Search patient name...">
                    </th>
                    <th>
                        <input type="text" class="form-control study-list-filter" v-model="filterUploadedBy" placeholder="Search uploaded by...">
                    </th>
                    <th></th>
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
                                <div class="col-6 study-list-bulk-buttons" v-if="selectedWordFileIds.length > 0">
                                    <button class="btn btn-sm btn-secondary m-1" @click="downloadSelectedWordFiles" title="Download">
                                        <i class="bi bi-download"></i> Download
                                    </button>
                                    <button class="btn btn-sm btn-secondary m-1" @click="printSelectedWordFiles" title="Print">
                                        <i class="bi bi-printer"></i> Print
                                    </button>
                                    <button class="btn btn-sm btn-danger m-1" @click="deleteSelectedWordFiles" title="Delete">
                                        <i class="bi bi-trash"></i> Delete
                                    </button>
                                </div>
                                <div class="col-4" v-else>
                                    <div v-if="loading" class="alert alert-secondary study-list-alert" role="alert">
                                        <span class="spinner-border spinner-border-sm alert-icon" role="status" aria-hidden="true"></span>
                                        Loading...
                                    </div>
                                    <div v-else-if="filteredWordFiles.length === 0" class="alert alert-warning study-list-alert" role="alert">
                                        <i class="bi bi-exclamation-triangle-fill alert-icon"></i> No documents found
                                    </div>
                                </div>
                            </div>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody v-if="loading">
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="spinner-border" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </td>
                </tr>
            </tbody>
            <tbody v-else-if="filteredWordFiles.length === 0">
                <tr>
                    <td colspan="7" class="text-center text-muted" style="padding: 20px;">
                        No documents found
                    </td>
                </tr>
            </tbody>
            <tbody v-for="wordFile in filteredWordFiles" :key="wordFile.id">
                <tr 
                    class="word-file-row" 
                    :class="{ 'word-file-row-expanded': isExpanded(wordFile.id) }"
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
                <tr v-if="isExpanded(wordFile.id)" class="word-file-details-row">
                    <td colspan="7">
                        <div class="word-file-details">
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

.study-table-actions > th > div {
    background-color: var(--study-table-actions-bg-color) !important;
    text-align: left;
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

.study-list-bulk-buttons {
    margin-top: var(--filter-margin, 5px);
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

.word-file-row {
    border-top-width: 1px;
    border-color: #ddd;
}

.word-file-row-expanded {
    background-color: var(--study-details-bg-color) !important;
    font-weight: 600;
}

.word-file-row-expanded > td {
    background-color: var(--study-details-bg-color) !important;
}

.word-file-details-row {
    background-color: var(--study-details-bg-color) !important;
}

.word-file-details-row > td {
    background-color: var(--study-details-bg-color) !important;
    padding: 0 !important;
}

.word-file-details {
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
}

.info-section h6 {
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
</style>
