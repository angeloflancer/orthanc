<script>
import Toasts from "./Toasts.vue"
import api from "../orthancApi"
import { renderAsync as renderDocx } from "docx-preview"

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
            filterHospital: '',
            filterUploadedBy: '',
            filterUploadedAt: null,
            // Document viewer modal
            showDocumentViewer: false,
            viewingDocument: null,
            documentViewerUrl: null,
            documentViewerLoading: false,
            isDocxPreview: false,
            docxPreviewError: false,
            printAfterOpen: false,
            userRole: 'doctor', // Default to doctor, will be loaded
            highlightedDocumentId: null, // ID of document to highlight
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                pages: 0
            }
        };
    },
    async created() {
        // Check for query params
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('patientId')) {
            this.filterPatientId = urlParams.get('patientId');
        }
        if (urlParams.has('documentId')) {
            this.highlightedDocumentId = urlParams.get('documentId');
        }
        await this.loadUserRole();
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
            this.pagination.page = 1;
            this.loadWordFiles();
        },
        filterPatientId() {
            this.pagination.page = 1;
            this.loadWordFiles();
        },
        filterPatientName() {
            this.pagination.page = 1;
            this.loadWordFiles();
        },
        filterHospital() {
            this.pagination.page = 1;
            this.loadWordFiles();
        },
        filterUploadedBy() {
            this.pagination.page = 1;
            this.loadWordFiles();
        },
        filterUploadedAt() {
            this.pagination.page = 1;
            this.loadWordFiles();
        },
        wordFiles() {
            this.filteredWordFiles = [...this.wordFiles];
            this.updateSelectAll();
        },
        '$route'(to, from) {
            // Only handle route changes if we're on the word-files route
            if (to.path === '/word-files' || to.path.startsWith('/word-files')) {
                let queryChanged = false;
                
                // Check if query parameters changed
                if (from) {
                    const fromQueryStr = JSON.stringify(from.query || {});
                    const toQueryStr = JSON.stringify(to.query || {});
                    queryChanged = fromQueryStr !== toQueryStr;
                }
                
                // Update patientId filter if it changed in URL
                const newPatientId = to.query.patientId || '';
                if (newPatientId !== this.filterPatientId) {
                    this.filterPatientId = newPatientId;
                }
                
                // Handle documentId parameter when route changes
                if (to.query.documentId) {
                    this.highlightedDocumentId = to.query.documentId;
                }
                
                // Always reload word files when:
                // 1. Query parameters changed (new document uploaded, filter changed, etc.)
                // 2. Coming from a different route
                // This ensures we see newly uploaded documents immediately
                if (queryChanged || (from && from.path !== to.path)) {
                    this.loadWordFiles();
                } else if (this.highlightedDocumentId && !this.loading) {
                    // If only documentId was added and data is already loaded, just scroll to it
                    this.$nextTick(() => {
                        this.scrollToDocument(this.highlightedDocumentId);
                        if (!this.isExpanded(this.highlightedDocumentId)) {
                            this.expandedWordFileId = this.highlightedDocumentId;
                        }
                    });
                }
            }
        }
    },
    computed: {
        hasSelection() {
            return this.selectedWordFileIds.length > 0;
        },
        isEmpty() {
            return !this.loading && this.pagination.total === 0;
        },
        isDoctor() {
            return this.userRole === 'doctor';
        }
    },
    methods: {
        buildWordFileParams() {
            const range = Array.isArray(this.filterUploadedAt) ? this.filterUploadedAt : (this.filterUploadedAt ? [this.filterUploadedAt] : []);
            let uploadedAtFrom, uploadedAtTo;
            if (range.length >= 1 && range[0]) uploadedAtFrom = new Date(range[0]).toISOString();
            if (range.length >= 2 && range[1]) uploadedAtTo = new Date(range[1]).toISOString();
            return {
                page: this.pagination.page,
                limit: this.pagination.limit,
                fileName: this.filterFileName.trim() || undefined,
                patientId: this.filterPatientId.trim() || undefined,
                patientName: this.filterPatientName.trim() || undefined,
                hospital: this.filterHospital.trim() || undefined,
                uploadedBy: this.filterUploadedBy.trim() || undefined,
                uploadedAtFrom,
                uploadedAtTo
            };
        },
        async loadWordFiles() {
            this.loading = true;
            try {
                const params = this.buildWordFileParams();
                const response = await api.getWordFiles(params);
                if (response.success) {
                    this.wordFiles = response.wordFiles || [];
                    this.filteredWordFiles = [...(response.wordFiles || [])];
                    if (response.pagination) {
                        this.pagination = { ...this.pagination, ...response.pagination };
                    }
                    this.updateSelectAll();
                    if (this.highlightedDocumentId) {
                        this.$nextTick(() => {
                            this.scrollToDocument(this.highlightedDocumentId);
                            if (!this.isExpanded(this.highlightedDocumentId)) {
                                this.expandedWordFileId = this.highlightedDocumentId;
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error loading word files:', error);
                this.messageBus.emit('show-toast', 'Failed to load Word files');
            } finally {
                this.loading = false;
            }
        },
        scrollToDocument(documentId) {
            this.$nextTick(() => {
                const element = document.getElementById(`word-file-${documentId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Remove highlight after a few seconds
                    setTimeout(() => {
                        this.highlightedDocumentId = null;
                        // Clean up URL parameter
                        const url = new URL(window.location);
                        url.searchParams.delete('documentId');
                        window.history.replaceState({}, '', url);
                    }, 5000);
                }
            });
        },
        applyFilters() {
            // Server-side filtering is used; filteredWordFiles is set from response in loadWordFiles
            this.filteredWordFiles = [...this.wordFiles];
            this.updateSelectAll();
        },
        goToPage(page) {
            if (page < 1 || page > this.pagination.pages) return;
            this.pagination.page = page;
            this.loadWordFiles();
        },
        clearFilters() {
            this.filterFileName = '';
            this.filterPatientId = '';
            this.filterPatientName = '';
            this.filterHospital = '';
            this.filterUploadedBy = '';
            this.filterUploadedAt = null;
            this.pagination.page = 1;
            this.loadWordFiles();
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
                const response = await api.deleteWordFile(id);
                // Check if response indicates success
                if (response && (response.success || response.message)) {
                    if (this.expandedWordFileId === id) {
                        this.expandedWordFileId = null;
                    }
                    this.messageBus.emit('show-toast', 'Document deleted successfully');
                    await this.loadWordFiles();
                } else {
                    throw new Error('Unexpected response format');
                }
            } catch (error) {
                console.error('Error deleting word file:', error);
                const errorMessage = error.response?.data?.error || error.message || 'Failed to delete document';
                this.messageBus.emit('show-toast', errorMessage);
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
                this.selectedWordFileIds = [];
                this.expandedWordFileId = null;
                this.messageBus.emit('show-toast', 'Selected documents deleted successfully');
                await this.loadWordFiles();
            } catch (error) {
                console.error('Error deleting word files:', error);
                this.messageBus.emit('show-toast', 'Failed to delete some documents');
            }
        },
        async viewWordFile(id) {
            try {
                this.viewingDocument = this.wordFiles.find(f => f.id === id);
                this.showDocumentViewer = true;
                this.documentViewerLoading = true;
                this.isDocxPreview = false;
                this.docxPreviewError = false;
                this.documentViewerUrl = null;

                const response = await api.downloadWordFile(id);
                const blob = new Blob([response.data]);

                const fileName = (this.viewingDocument?.originalFileName || '').toLowerCase();
                const isDocx = fileName.endsWith('.docx');

                if (isDocx) {
                    // Switch off loading to render into the DOM, then render DOCX
                    this.documentViewerLoading = false;
                    await this.$nextTick();

                    if (this.$refs.docxContainer) {
                        this.$refs.docxContainer.innerHTML = '';

                        try {
                            await renderDocx(blob, this.$refs.docxContainer, null, {
                                className: "emx-docx",
                                inWrapper: true,
                                ignoreWidth: true,
                                ignoreHeight: true,
                                breakPages: false
                            });
                            this.isDocxPreview = true;
                            this.documentViewerLoading = false;
                            if (this.printAfterOpen) {
                                this.printAfterOpen = false;
                                this.$nextTick(() => this.printViewingDocument());
                            }
                            return;
                        } catch (e) {
                            console.error('Error rendering DOCX preview:', e);
                            this.docxPreviewError = true;
                            this.isDocxPreview = false;
                        }
                    }
                }

                // Fallback: keep download-only message (non-docx or preview failed)
                this.documentViewerUrl = window.URL.createObjectURL(blob);
                this.documentViewerLoading = false;
                if (this.printAfterOpen) {
                    this.printAfterOpen = false;
                    this.$nextTick(() => this.printViewingDocument());
                }
            } catch (error) {
                console.error('Error viewing word file:', error);
                this.messageBus.emit('show-toast', 'Failed to view document');
                this.closeDocumentViewer();
            }
        },
        closeDocumentViewer() {
            this.showDocumentViewer = false;
            this.viewingDocument = null;
            this.isDocxPreview = false;
            this.docxPreviewError = false;
            this.printAfterOpen = false;
            if (this.documentViewerUrl) {
                window.URL.revokeObjectURL(this.documentViewerUrl);
                this.documentViewerUrl = null;
            }
            if (this.$refs.docxContainer) {
                this.$refs.docxContainer.innerHTML = '';
            }
            this.documentViewerLoading = false;
        },
        downloadViewingDocument() {
            if (this.viewingDocument) {
                this.downloadWordFile(this.viewingDocument.id);
            }
        },
        printViewingDocument() {
            if (!this.showDocumentViewer || !this.viewingDocument) return;
            document.body.classList.add('printing-document-modal');
            this.$nextTick(() => {
                window.print();
                document.body.classList.remove('printing-document-modal');
            });
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
            if (this.showDocumentViewer && this.viewingDocument?.id === id) {
                this.printViewingDocument();
                return;
            }
            this.printAfterOpen = true;
            await this.viewWordFile(id);
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
        },
        async loadUserRole() {
            try {
                const token = localStorage.getItem('auth-token');
                if (!token) return;
                
                const response = await api.getCurrentUser();
                if (response.success && response.user) {
                    this.userRole = response.user.role || 'doctor';
                }
            } catch (error) {
                console.error('Error loading user role:', error);
            }
        }
    }
}
</script>

<template>
    <div class="documents-page">
        <div class="table-wrapper">
        <table class="table table-sm study-table table-borderless">
            <thead class="sticky-top">
                <tr class="study-column-titles">
                    <th scope="col" class="checkbox-cell" width="1%"></th>
                    <th width="20%" class="study-table-title" scope="col">File Name</th>
                    <th width="10%" class="study-table-title" scope="col">Patient ID</th>
                    <th width="20%" class="study-table-title" scope="col">Patient Name</th>
                    <th width="15%" class="study-table-title" scope="col">Hospital</th>
                    <th width="15%" class="study-table-title" scope="col">Uploaded By</th>
                    <th width="15%" class="study-table-title" scope="col">Uploaded At</th>
                    <th width="5%" class="study-table-title" scope="col">Delete</th>
                </tr>
                <tr class="study-table-filters">
                    <th scope="col" class="checkbox-cell">
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
                        <input type="text" class="form-control study-list-filter" v-model="filterHospital" placeholder="Search hospital...">
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
                    <th scope="col" class="checkbox-cell">
                        <div class="checkbox-wrapper">
                            <input class="form-check-input" type="checkbox" v-model="allSelected"
                                :indeterminate="isPartialSelected" @click="clickSelectAll">
                            <span class="selection-count">{{ selectedWordFileIds.length }}</span>
                        </div>
                    </th>
                    <th width="97%" colspan="8" scope="col">
                        <div class="bulk-actions-wrap">
                            <button class="btn btn-sm btn-secondary" @click="downloadSelectedWordFiles" 
                                :disabled="!hasSelection" title="Download">
                                <i class="bi bi-download"></i> Download
                            </button>
                            <button class="btn btn-sm btn-secondary" @click="printSelectedWordFiles" 
                                :disabled="!hasSelection" title="Print">
                                <i class="bi bi-printer"></i> Print
                            </button>
                            <button class="btn btn-sm btn-danger" @click="deleteSelectedWordFiles" 
                                :disabled="!hasSelection || isDoctor" title="Delete">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </div>
                    </th>
                </tr>
            </thead>
            <tbody v-if="loading">
                <tr>
                    <td colspan="8" class="text-center" style="padding: 60px 20px;">
                        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-3 text-muted">Loading documents...</p>
                    </td>
                </tr>
            </tbody>
            <tbody v-else-if="isEmpty" class="empty-state-tbody">
                <tr class="empty-state-row">
                    <td colspan="8">
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
                    :class="{ 
                        'data-row-expanded': isExpanded(wordFile.id),
                        'highlighted-document': highlightedDocumentId === wordFile.id
                    }"
                    :id="`word-file-${wordFile.id}`"
                >
                    <td class="checkbox-cell">
                        <div class="checkbox-wrapper">
                            <input 
                                class="form-check-input" 
                                type="checkbox" 
                                :checked="selectedWordFileIds.includes(wordFile.id)" 
                                @change="onWordFileSelected(wordFile.id, $event.target.checked)"
                                @click.stop
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
                    <td class="cut-text" data-bs-toggle="tooltip" :title="wordFile.hospitalName" @click="toggleExpand(wordFile.id)" style="cursor: pointer;">
                        {{ wordFile.hospitalName }}
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
                            :disabled="isDoctor"
                            title="Delete"
                        >
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
                <!-- Expanded row with details -->
                <tr v-if="isExpanded(wordFile.id)" class="details-row">
                    <td colspan="8">
                        <div class="details-card">
                            <div class="details-main">
                                <!-- File Info Card -->
                                <div class="file-info-card">
                                    <div class="file-icon-wrap">
                                        <i class="bi bi-file-earmark-word-fill"></i>
                                    </div>
                                    <div class="file-meta">
                                        <div class="file-name">{{ wordFile.originalFileName }}</div>
                                        <div class="file-size">{{ formatFileSize(wordFile.fileSize) }}</div>
                                    </div>
                                </div>
                                
                                <!-- Info Columns -->
                                <div class="info-columns">
                                    <div class="info-column">
                                        <div class="info-column-title">Patient</div>
                                        <div class="info-item">
                                            <span class="info-key">ID</span>
                                            <span class="info-val">{{ wordFile.patientId }}</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-key">Name</span>
                                            <span class="info-val">{{ wordFile.patientName }}</span>
                                        </div>
                                    </div>
                                    <div class="info-column">
                                        <div class="info-column-title">Upload Details</div>
                                        <div class="info-item">
                                            <span class="info-key">By</span>
                                            <span class="info-val">{{ wordFile.uploadedByName }}</span>
                                        </div>
                                        <div class="info-item">
                                            <span class="info-key">Date</span>
                                            <span class="info-val">{{ formatDate(wordFile.uploadedAt) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Actions Bar -->
                            <div class="actions-bar">
                                <button type="button" class="action-btn action-view" @click="viewWordFile(wordFile.id)">
                                    <i class="bi bi-eye"></i> View
                                </button>
                                <button type="button" class="action-btn action-download" @click="downloadWordFile(wordFile.id)">
                                    <i class="bi bi-download"></i> Download
                                </button>
                                <button type="button" class="action-btn action-print" @click="printWordFile(wordFile.id)">
                                    <i class="bi bi-printer"></i> Print
                                </button>
                                <button type="button" class="action-btn action-delete" @click="deleteWordFile(wordFile.id)" :disabled="isDoctor">
                                    <i class="bi bi-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
        </div>
        <!-- Pagination -->
        <div v-if="!loading && pagination.pages > 1" class="pagination-section">
            <button
                class="btn btn-sm btn-outline-secondary"
                :disabled="pagination.page <= 1"
                @click="goToPage(pagination.page - 1)"
            >
                <i class="bi bi-chevron-left"></i>
            </button>
            <span class="page-info">
                Page {{ pagination.page }} of {{ pagination.pages }}
            </span>
            <button
                class="btn btn-sm btn-outline-secondary"
                :disabled="pagination.page >= pagination.pages"
                @click="goToPage(pagination.page + 1)"
            >
                <i class="bi bi-chevron-right"></i>
            </button>
        </div>
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
                        <button class="btn btn-sm btn-outline-secondary me-2" @click="printViewingDocument" title="Print">
                            <i class="bi bi-printer me-1"></i> Print
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
                    <div v-else class="document-viewer-content">
                        <!-- Always render container so docx-preview can mount -->
                        <div
                            ref="docxContainer"
                            class="docx-preview-container"
                            v-show="isDocxPreview && !docxPreviewError"
                        ></div>

                        <!-- Fallback banner when not previewing or on error -->
                        <div v-if="!isDocxPreview || docxPreviewError" class="document-preview-fallback">
                            <div class="document-info-banner">
                                <i class="bi bi-info-circle me-2"></i>
                                Word documents cannot be fully previewed directly in the browser. Please download the file to view its contents.
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
    </div>
</template>

<style scoped>
/* Responsive layout */
.documents-page {
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

.study-table {
    table-layout: fixed !important;
    min-width: 900px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

/* Bulk actions responsive wrapping */
.bulk-actions-wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
}

.bulk-actions-wrap .btn {
    flex-shrink: 0;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.15s ease;
}

.bulk-actions-wrap .btn-secondary {
    background: #e5e7eb;
    border: none;
    color: #374151;
}

.bulk-actions-wrap .btn-secondary:hover:not(:disabled) {
    background: #d1d5db;
}

.bulk-actions-wrap .btn-danger {
    background: #fee2e2;
    border: none;
    color: #dc2626;
}

.bulk-actions-wrap .btn-danger:hover:not(:disabled) {
    background: #fecaca;
}

.bulk-actions-wrap .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Table row alternation */
.study-table > tbody:not(.empty-state-tbody) > tr.data-row:nth-child(odd) > td {
    background-color: #ffffff;
}

.study-table > tbody:not(.empty-state-tbody) > tr.data-row:nth-child(even) > td {
    background-color: #f9fafb;
}

.study-table > tbody > tr.data-row:hover > td {
    background-color: #f3f4f6;
}

.study-table > :last-child {
    border-bottom-width: thin;
}

/* Modern Table Header */
.study-column-titles {
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    border-bottom: 1px solid #e2e8f0 !important;
}

.study-table-title {
    text-align: left;
    padding: 14px 12px;
    vertical-align: middle !important;
    line-height: 1.5;
    position: sticky;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

/* Filter Row */
.study-table-filters {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
}

.study-table-filters > th {
    background: #ffffff;
    padding: 8px 12px;
    vertical-align: middle;
}

/* Actions Row */
.study-table-actions {
    background: #f8fafc !important;
    border-bottom: 1px solid #e5e7eb;
}

.study-table-actions > th {
    background: #f8fafc !important;
    vertical-align: middle;
    padding: 10px 12px;
}

.study-table-actions > th > div {
    background: transparent !important;
    text-align: left;
}

/* Table Cells */
.study-table td {
    text-align: left;
    padding: 14px 12px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    vertical-align: middle;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
}

/* Checkbox cell - consistent alignment */
.checkbox-cell {
    width: 60px !important;
    min-width: 60px !important;
    max-width: 60px !important;
    padding: 8px 12px !important;  /* More comfortable padding */
    vertical-align: middle !important;
    box-sizing: border-box !important;
}

.checkbox-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 8px;
}

.checkbox-wrapper .form-check-input {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
    flex-shrink: 0;
}

.selection-count {
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
}

/* Clear filter button - modern style */
.clear-filter-btn {
    width: 24px;
    height: 24px;
    min-width: 24px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
    border-radius: 5px;
    background: #f9fafb;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-left: 8px;
}

.clear-filter-btn:hover {
    background: #fee2e2;
    border-color: #fecaca;
    color: #dc2626;
}

.clear-filter-btn i {
    font-size: 12px;
}

/* Row delete button */
.data-row .btn-danger {
    background: #fee2e2;
    border: none;
    color: #dc2626;
    border-radius: 8px;
    padding: 8px 12px;
    transition: all 0.15s ease;
}

.data-row .btn-danger:hover:not(:disabled) {
    background: #fecaca;
}

.data-row .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

input.form-control.study-list-filter {
    margin: 0;
    padding: 8px 12px;
    font-size: 13px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f9fafb;
    transition: all 0.15s ease;
}

input.form-control.study-list-filter:focus {
    background: #ffffff;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    outline: none;
}

input.form-control.study-list-filter::placeholder {
    color: #9ca3af;
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
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.data-row-expanded {
    background: #f0f9ff !important;
}

.data-row-expanded > td {
    background: #f0f9ff !important;
    font-weight: 500;
    color: #0369a1;
    border-bottom-color: transparent !important;
}

/* Highlighted document styles */
.highlighted-document {
    background-color: #fff3cd !important;
    border-left: 4px solid #ffc107 !important;
    animation: highlightPulse 2s ease-in-out;
}

.highlighted-document > td {
    background-color: #fff3cd !important;
}

@keyframes highlightPulse {
    0%, 100% {
        background-color: #fff3cd;
    }
    50% {
        background-color: #ffe69c;
    }
}

/* Modern Details Card */
.details-row {
    background: transparent !important;
}

.details-row > td {
    background: transparent !important;
    padding: 0 16px 16px 16px !important;
}

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

/* File Info Card */
.file-info-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-right: 28px;
    border-right: 1px solid #e5e7eb;
    min-width: 220px;
}

.file-icon-wrap {
    width: 52px;
    height: 52px;
    background: linear-gradient(135deg, #2b579a 0%, #1a3a6c 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.file-icon-wrap i {
    font-size: 26px;
    color: #ffffff;
}

.file-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.file-name {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
}

.file-size {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
}

/* Info Columns */
.info-columns {
    display: flex;
    gap: 40px;
    padding-left: 28px;
    flex: 1;
    flex-wrap: wrap;
}

.info-column {
    min-width: 180px;
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
    min-width: 45px;
}

.info-val {
    color: #1f2937;
    font-weight: 500;
}

/* Actions Bar */
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

.action-btn i {
    font-size: 14px;
}

.action-view {
    background: #e0e7ff;
    color: #4338ca;
}

.action-view:hover {
    background: #c7d2fe;
}

.action-download {
    background: #d1fae5;
    color: #047857;
}

.action-download:hover {
    background: #a7f3d0;
}

.action-print {
    background: #e5e7eb;
    color: #374151;
}

.action-print:hover {
    background: #d1d5db;
}

.action-delete {
    background: #fee2e2;
    color: #dc2626;
}

.action-delete:hover:not(:disabled) {
    background: #fecaca;
}

.action-delete:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Responsive for details card */
@media (max-width: 768px) {
    .details-main {
        flex-direction: column;
        gap: 16px;
    }
    
    .file-info-card {
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

/* Document Viewer Modal */
.document-viewer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.document-viewer-modal {
    background: #fafafa;
    border-radius: 12px;
    width: 88%;
    max-width: 820px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.12);
}

.document-viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    background: #fff;
    border-bottom: 1px solid #eee;
    border-radius: 12px 12px 0 0;
}

.document-viewer-header h5 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #1a1a1a;
}

.document-viewer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.document-viewer-body {
    flex: 1;
    overflow: auto;
    padding: 20px;
    background: #f5f5f5;
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
    align-items: stretch;
    width: 100%;
}

.docx-preview-container {
    width: 100%;
    max-width: 100%;
    overflow: auto;
    background: #f5f5f5;
    border-radius: 8px;
    padding: 24px;
}

/* Override docx-preview default gray wrapper: one natural “page” look */
.docx-preview-container :deep(.emx-docx-wrapper) {
    background: transparent !important;
    padding: 0 !important;
    display: block !important;
    max-width: 100%;
}

.docx-preview-container :deep(.emx-docx-wrapper > section.emx-docx) {
    background: #fff !important;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08) !important;
    margin: 0 auto 24px !important;
    max-width: 100%;
    border-radius: 4px;
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

.pagination-section {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    margin-top: 12px;
}

.pagination-section .btn {
    border-radius: 8px;
    padding: 8px 14px;
    font-weight: 500;
    transition: all 0.15s ease;
}

.page-info {
    font-size: 13px;
    font-weight: 500;
    color: #6b7280;
}
</style>

<style>
/* Unscoped: print only the document viewer modal (no new tab) */
@media print {
    body.printing-document-modal * {
        visibility: hidden;
    }
    body.printing-document-modal .document-viewer-overlay,
    body.printing-document-modal .document-viewer-overlay * {
        visibility: visible;
    }
    body.printing-document-modal .document-viewer-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: white !important;
        align-items: flex-start !important;
    }
    body.printing-document-modal .document-viewer-modal {
        max-height: none !important;
        box-shadow: none !important;
        width: 100% !important;
    }
}
</style>
