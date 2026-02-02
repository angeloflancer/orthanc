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
            // Search filters
            filterFileName: '',
            filterPatientId: '',
            filterPatientName: '',
            filterHospital: '',
            filterUploadedBy: '',
            filterUploadedAt: null,
            filterType: '', // '' | 'PDF' | 'DOCX' | 'XLSX' | 'OTHER'
            viewMode: 'list', // 'list' | 'grid'
            openRowMenuId: null, // id of row whose actions dropdown is open
            // Pagination (match reference: 5 per page)
            pageSize: 5,
            currentPage: 1,
            // Document viewer modal
            showDocumentViewer: false,
            viewingDocument: null,
            documentViewerUrl: null,
            documentViewerLoading: false,
            isDocxPreview: false,
            docxPreviewError: false,
            printAfterOpen: false,
            userRole: 'doctor', // Default to doctor, will be loaded
            highlightedDocumentId: null // ID of document to highlight
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
            this.applyFilters();
        },
        filterPatientId() {
            this.applyFilters();
        },
        filterPatientName() {
            this.applyFilters();
        },
        filterHospital() {
            this.applyFilters();
        },
        filterUploadedBy() {
            this.applyFilters();
        },
        filterUploadedAt() {
            this.applyFilters();
        },
        filterType() {
            this.applyFilters();
        },
        wordFiles() {
            this.applyFilters();
        },
        currentPage() {
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
                    this.$nextTick(() => this.scrollToDocument(this.highlightedDocumentId));
                }
            }
        }
    },
    computed: {
        hasSelection() {
            return this.selectedWordFileIds.length > 0;
        },
        isEmpty() {
            return !this.loading && this.filteredWordFiles.length === 0;
        },
        isDoctor() {
            return this.userRole === 'doctor';
        },
        totalPages() {
            const n = this.filteredWordFiles.length;
            return n === 0 ? 1 : Math.ceil(n / this.pageSize);
        },
        paginatedWordFiles() {
            const start = (this.currentPage - 1) * this.pageSize;
            return this.filteredWordFiles.slice(start, start + this.pageSize);
        },
        paginationStart() {
            if (this.filteredWordFiles.length === 0) return 0;
            return (this.currentPage - 1) * this.pageSize + 1;
        },
        paginationEnd() {
            return Math.min(this.currentPage * this.pageSize, this.filteredWordFiles.length);
        },
        paginationPageNumbers() {
            const total = this.totalPages;
            if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
            const p = this.currentPage;
            const pages = [];
            pages.push(1);
            if (p > 3) pages.push('...');
            for (let i = Math.max(2, p - 1); i <= Math.min(total - 1, p + 1); i++) {
                if (!pages.includes(i)) pages.push(i);
            }
            if (p < total - 2) pages.push('...');
            if (total > 1) pages.push(total);
            return pages;
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
                    
                    if (this.highlightedDocumentId) {
                        this.$nextTick(() => this.scrollToDocument(this.highlightedDocumentId));
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
            
            if (this.filterHospital.trim()) {
                const search = this.filterHospital.toLowerCase();
                filtered = filtered.filter(file => 
                    (file.hospitalName || '').toLowerCase().includes(search)
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
            if (this.filterType) {
                filtered = filtered.filter(file => this.getFileType(file) === this.filterType);
            }
            this.filteredWordFiles = filtered;
            this.currentPage = 1;

            const temp = "";
            console.log('filteredWordFiles', this.filteredWordFiles, temp.length > 1 ? !(temp[1].hospitalName.length == 0) : '');
            this.updateSelectAll();
            
            // If there's a highlighted document, scroll to it after filters are applied
            if (this.highlightedDocumentId) {
                this.$nextTick(() => {
                    this.scrollToDocument(this.highlightedDocumentId);
                });
            }
        },
        clearFilters() {
            this.filterFileName = '';
            this.filterPatientId = '';
            this.filterPatientName = '';
            this.filterHospital = '';
            this.filterUploadedBy = '';
            this.filterUploadedAt = null;
            this.filterType = '';
        },
        getFileType(file) {
            const name = (file.originalFileName || '').toUpperCase();
            if (name.endsWith('.PDF')) return 'PDF';
            if (name.endsWith('.DOCX') || name.endsWith('.DOC')) return 'DOCX';
            if (name.endsWith('.XLSX') || name.endsWith('.XLS')) return 'XLSX';
            return 'OTHER';
        },
        formatDateShort(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        },
        fileIconSvg(type) {
            const icons = {
                PDF: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13H8"/><path d="M16 17h-6"/><path d="M14 13h-4"/></svg>',
                DOCX: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>',
                XLSX: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 15h2"/><path d="M14 11h2"/><path d="M8 11h2"/><path d="M14 15h2"/></svg>',
                OTHER: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="5" y="2" rx="2"/><path d="M15 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9h4"/><path d="M10 13h4"/><path d="M10 17h2"/></svg>'
            };
            return icons[type] || icons.OTHER;
        },
        closeRowMenu() {
            this.openRowMenuId = null;
        },
        toggleRowMenu(id) {
            this.openRowMenuId = this.openRowMenuId === id ? null : id;
        },
        async deleteWordFile(id) {
            if (!confirm('Are you sure you want to delete this document?')) {
                return;
            }
            
            try {
                const response = await api.deleteWordFile(id);
                // Check if response indicates success
                if (response && (response.success || response.message)) {
                    this.wordFiles = this.wordFiles.filter(file => file.id !== id);
                    this.filteredWordFiles = this.filteredWordFiles.filter(file => file.id !== id);
                    this.openRowMenuId = null;
                    this.messageBus.emit('show-toast', 'Document deleted successfully');
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
                this.wordFiles = this.wordFiles.filter(file => !this.selectedWordFileIds.includes(file.id));
                this.selectedWordFileIds = [];
                this.openRowMenuId = null;
                this.messageBus.emit('show-toast', 'Selected documents deleted successfully');
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
            const pageIds = this.paginatedWordFiles.map(f => f.id);
            const selectedOnPage = pageIds.filter(id => this.selectedWordFileIds.includes(id));
            if (selectedOnPage.length === 0) {
                this.allSelected = false;
                this.isPartialSelected = false;
            } else if (selectedOnPage.length === pageIds.length) {
                this.allSelected = true;
                this.isPartialSelected = false;
            } else {
                this.allSelected = '';
                this.isPartialSelected = true;
            }
        },
        clickSelectAll() {
            const pageIds = this.paginatedWordFiles.map(f => f.id);
            const allPageSelected = pageIds.every(id => this.selectedWordFileIds.includes(id));
            if (allPageSelected) {
                this.selectedWordFileIds = this.selectedWordFileIds.filter(id => !pageIds.includes(id));
            } else {
                pageIds.forEach(id => {
                    if (!this.selectedWordFileIds.includes(id)) this.selectedWordFileIds.push(id);
                });
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
        },
        openUploadPanel() {
            this.messageBus.emit('open-upload-panel');
            this.$nextTick(() => {
                setTimeout(() => {
                    document.getElementById('wordFilesUpload')?.click();
                }, 350);
            });
        }
    }
}
</script>

<template>
    <div class="documents-page-modern" @click.self="closeRowMenu">
        <header class="documents-header">
            <div class="documents-header-top">
                <div>
                    <h1 class="documents-title">All Documents</h1>
                    <p class="documents-subtitle">Manage patient documents and reports</p>
                </div>
                <div class="documents-header-actions">
                    <button type="button" class="documents-btn documents-btn-ghost documents-btn-icon" @click="loadWordFiles" title="Refresh" :disabled="loading">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    </button>
                    <a href="#" class="documents-btn documents-btn-primary documents-btn-link" @click.prevent="openUploadPanel">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        Upload Document
                    </a>
                </div>
            </div>
            <div class="documents-toolbar">
                <div class="documents-search-wrap">
                    <svg class="documents-search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input type="search" class="documents-search-input" v-model="filterFileName" placeholder="Search documents..." />
                </div>
                <div class="documents-toolbar-right">
                    <div class="documents-select-wrap documents-disabled-control">
                        <select class="documents-select" v-model="filterType" disabled title="Not yet implemented">
                            <option value="">All Types</option>
                            <option value="PDF">PDF</option>
                            <option value="DOCX">DOCX</option>
                            <option value="XLSX">XLSX</option>
                            <option value="OTHER">Other</option>
                        </select>
                        <svg class="documents-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                    <div class="documents-view-toggle documents-disabled-control">
                        <button type="button" class="documents-view-btn" :class="{ active: viewMode === 'list' }" disabled title="Not yet implemented"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg></button>
                        <button type="button" class="documents-view-btn" :class="{ active: viewMode === 'grid' }" disabled title="Not yet implemented"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg></button>
                    </div>
                </div>
            </div>
        </header>

        <div v-if="hasSelection" class="documents-selection-bar">
            <p class="documents-selection-text"><span class="documents-selection-count">{{ selectedWordFileIds.length }}</span> documents selected</p>
            <div class="documents-selection-actions">
                <button type="button" class="documents-btn documents-btn-outline" @click="downloadSelectedWordFiles" :disabled="!hasSelection">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Download
                </button>
                <button type="button" class="documents-btn documents-btn-destructive" @click="deleteSelectedWordFiles" :disabled="!hasSelection || isDoctor">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    Delete
                </button>
            </div>
        </div>

        <div class="documents-table-card">
            <div v-if="loading" class="documents-loading">
                <div class="documents-spinner"></div>
                <p>Loading documents...</p>
            </div>
            <template v-else-if="isEmpty">
                <div class="documents-empty">
                    <svg class="documents-empty-icon" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="18" y2="12"/><line x1="9" x2="15" y1="15" y2="15"/></svg>
                    <h3 class="documents-empty-title">No Documents Found</h3>
                    <p class="documents-empty-text">There are no documents matching your criteria. Try adjusting your filters or upload new documents.</p>
                </div>
            </template>
            <table v-else class="documents-table">
                <thead>
                    <tr class="documents-thead-row">
                        <th class="documents-th documents-th-checkbox"><input type="checkbox" class="documents-checkbox" :checked="allSelected === true" :indeterminate.prop="isPartialSelected" @change="clickSelectAll" /></th>
                        <th class="documents-th">Document Name</th>
                        <th class="documents-th">Type</th>
                        <th class="documents-th">Size</th>
                        <th class="documents-th">Patient</th>
                        <th class="documents-th">Uploaded By</th>
                        <th class="documents-th">Date</th>
                        <th class="documents-th documents-th-actions"></th>
                    </tr>
                </thead>
                <tbody>
                    <template v-for="wordFile in paginatedWordFiles" :key="wordFile.id">
                        <tr
                            class="documents-tr"
                            :class="{ 'documents-tr-highlighted': highlightedDocumentId === wordFile.id }"
                            :id="`word-file-${wordFile.id}`"
                        >
                            <td class="documents-td documents-td-checkbox" @click.stop><input type="checkbox" class="documents-checkbox" :checked="selectedWordFileIds.includes(wordFile.id)" @change="onWordFileSelected(wordFile.id, $event.target.checked)" @click.stop /></td>
                            <td class="documents-td documents-td-name">
                                <span class="documents-file-icon" :class="'documents-file-icon--' + getFileType(wordFile)" v-html="fileIconSvg(getFileType(wordFile))"></span>
                                <span class="documents-file-name">{{ wordFile.originalFileName }}</span>
                            </td>
                            <td class="documents-td"><span class="documents-badge">{{ getFileType(wordFile) }}</span></td>
                            <td class="documents-td documents-td-muted">{{ formatFileSize(wordFile.fileSize) }}</td>
                            <td class="documents-td">
                                <div class="documents-patient">
                                    <span class="documents-patient-name">{{ wordFile.patientName }}</span>
                                    <span class="documents-patient-id">ID: {{ wordFile.patientId }}</span>
                                </div>
                            </td>
                            <td class="documents-td documents-td-muted">{{ wordFile.uploadedByName }}</td>
                            <td class="documents-td documents-td-muted">{{ formatDateShort(wordFile.uploadedAt) }}</td>
                            <td class="documents-td documents-td-actions" @click.stop>
                                <div class="documents-row-menu-wrap">
                                    <button type="button" class="documents-btn documents-btn-ghost documents-btn-icon documents-row-menu-btn" @click="toggleRowMenu(wordFile.id)" title="Actions">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                    </button>
                                    <div v-show="openRowMenuId === wordFile.id" class="documents-row-menu" @click.stop>
                                        <button type="button" class="documents-row-menu-item" @click="closeRowMenu(); viewWordFile(wordFile.id)">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                            View
                                        </button>
                                        <button type="button" class="documents-row-menu-item" @click="closeRowMenu(); downloadWordFile(wordFile.id)">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                            Download
                                        </button>
                                        <button type="button" class="documents-row-menu-item documents-row-menu-item-danger" @click="closeRowMenu(); deleteWordFile(wordFile.id)" :disabled="isDoctor">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>

        <div v-if="!loading && !isEmpty" class="documents-pagination">
            <p class="documents-pagination-text">Showing <span class="documents-pagination-bold">{{ paginationStart }}</span>-<span class="documents-pagination-bold">{{ paginationEnd }}</span> of <span class="documents-pagination-bold">{{ filteredWordFiles.length }}</span> documents</p>
            <div class="documents-pagination-nav">
                <button type="button" class="documents-btn documents-btn-outline documents-btn-sm" :disabled="currentPage <= 1" @click="currentPage = Math.max(1, currentPage - 1)">Previous</button>
                <template v-for="(num, idx) in paginationPageNumbers" :key="num === '...' ? 'ellipsis-' + idx : num">
                    <button v-if="num === '...'" type="button" class="documents-btn documents-btn-ghost documents-btn-sm documents-btn-pagination" disabled>...</button>
                    <button v-else type="button" class="documents-btn documents-btn-ghost documents-btn-sm documents-btn-pagination" :class="{ 'documents-btn-pagination-active': currentPage === num }" @click="currentPage = num">{{ num }}</button>
                </template>
                <button type="button" class="documents-btn documents-btn-outline documents-btn-sm" :disabled="currentPage >= totalPages" @click="currentPage = Math.min(totalPages, currentPage + 1)">Next</button>
            </div>
        </div>

        <Toasts />

        <!-- Document Viewer Modal -->
        <div v-if="showDocumentViewer" class="document-viewer-overlay" @click.self="closeDocumentViewer">
            <div class="document-viewer-modal">
                <div class="document-viewer-header">
                    <h5>{{ viewingDocument?.originalFileName }}</h5>
                    <div class="document-viewer-actions">
                        <button type="button" class="documents-btn documents-btn-outline documents-btn-sm" @click="downloadViewingDocument">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                            Download
                        </button>
                        <button type="button" class="documents-btn documents-btn-outline documents-btn-sm" @click="printViewingDocument" title="Print">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                            Print
                        </button>
                        <button type="button" class="documents-btn documents-btn-ghost documents-btn-icon" @click="closeDocumentViewer" title="Close">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>
                </div>
                <div class="document-viewer-body">
                    <div v-if="documentViewerLoading" class="document-viewer-loading">
                        <div class="documents-spinner" role="status"></div>
                        <p>Loading document...</p>
                    </div>
                    <div v-else class="document-viewer-content">
                        <div ref="docxContainer" class="docx-preview-container" v-show="isDocxPreview && !docxPreviewError"></div>
                        <div v-if="!isDocxPreview || docxPreviewError" class="document-preview-fallback">
                            <div class="document-info-banner">Word documents cannot be fully previewed directly in the browser. Please download the file to view its contents.</div>
                            <div class="document-preview-placeholder">
                                <span v-if="viewingDocument" v-html="fileIconSvg(getFileType(viewingDocument))"></span>
                                <h4>{{ viewingDocument?.originalFileName }}</h4>
                                <p class="documents-td-muted" style="margin: 0 0 1rem;">Patient: {{ viewingDocument?.patientName }} ({{ viewingDocument?.patientId }})<br>Uploaded: {{ formatDate(viewingDocument?.uploadedAt) }}</p>
                                <button type="button" class="documents-btn documents-btn-primary" @click="downloadViewingDocument">Download to View</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.documents-page-modern {
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: left;
    color: var(--content-foreground);
    background: var(--content-background);
    min-height: 100vh;
    margin: -24px;
    padding: 1.5rem 1rem;
}
@media (min-width: 1024px) {
    .documents-page-modern {
        padding-left: 2rem;
        padding-right: 2rem;
    }
}
.documents-header {
    position: sticky;
    top: 0;
    z-index: 30;
    margin-bottom: 1.5rem;
    padding: 1rem 0;
    background: oklch(0.96 0.01 80 / 0.8);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--content-border);
}
[data-bs-theme="dark"] .documents-header {
    background: oklch(0.12 0.01 60 / 0.8);
}
.documents-header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.documents-title { font-size: 1.25rem; font-weight: 600; color: var(--content-foreground); margin: 0 0 2px; }
.documents-subtitle { font-size: 0.875rem; color: var(--content-muted-foreground); margin: 0; }
.documents-header-actions { display: flex; align-items: center; gap: 0.75rem; }
.documents-toolbar { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; }
.documents-search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 28rem; }
.documents-search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--content-muted-foreground); }
.documents-search-input { width: 100%; min-height: 2.25rem; padding: 0.5rem 1rem 0.5rem 2.25rem; font-size: 0.875rem; font-family: inherit; color: var(--content-foreground); background: var(--content-secondary); border: 1px solid transparent; border-radius: 9999px; outline: none; box-shadow: var(--content-shadow-xs); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.documents-search-input::placeholder { color: var(--content-muted-foreground); }
.documents-search-input:hover { border-color: var(--content-border); }
.documents-search-input:focus { border-color: var(--content-primary); box-shadow: 0 0 0 3px rgba(8, 5, 3, 0.12); }
.documents-toolbar-right { display: flex; align-items: center; gap: 0.5rem; }
.documents-select-wrap { position: relative; }
.documents-select { appearance: none; padding: 0.5rem 2rem 0.5rem 0.75rem; font-size: 0.875rem; font-family: inherit; color: var(--content-foreground); background: transparent; border: 1px solid var(--content-border); border-radius: 9999px; cursor: pointer; outline: none; transition: border-color 0.2s ease, background-color 0.2s ease; }
.documents-select:hover { border-color: var(--content-muted-foreground); }
.documents-select:focus { border-color: var(--content-primary); outline: none; box-shadow: 0 0 0 2px rgba(8, 5, 3, 0.1); }
.documents-chevron { position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); color: var(--content-muted-foreground); pointer-events: none; }
.documents-view-toggle { display: flex; border: 1px solid var(--content-border); border-radius: 9999px; padding: 2px; }
.documents-view-btn { width: 2rem; height: 2rem; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 9999px; background: transparent; color: var(--content-muted-foreground); cursor: pointer; transition: background-color 0.2s ease, color 0.2s ease; }
.documents-view-btn:hover { background: var(--content-secondary); color: var(--content-foreground); }
.documents-view-btn:active { background: var(--content-accent); }
.documents-view-btn.active { background: var(--content-secondary); color: var(--content-foreground); }
.documents-disabled-control { opacity: 0.6; pointer-events: none; cursor: not-allowed; }
.documents-disabled-control .documents-select,
.documents-disabled-control .documents-view-btn { cursor: not-allowed; }
.documents-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: 2.25rem; padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 500; font-family: inherit; border-radius: 9999px; border: none; cursor: pointer; transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease; outline: none; }
.documents-btn:focus-visible { box-shadow: 0 0 0 3px var(--content-ring, rgba(8, 5, 3, 0.15)); }
.documents-btn:active:not(:disabled) { opacity: 0.9; }
.documents-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.documents-btn-icon { padding: 0; width: 2.25rem; height: 2.25rem; min-width: 2.25rem; min-height: 2.25rem; }
.documents-btn-ghost { background: transparent; color: var(--content-foreground); }
.documents-btn-ghost:hover { background: var(--content-accent); color: var(--content-accent-foreground); }
.documents-btn-ghost:active:not(:disabled) { background: var(--content-secondary); }
.documents-btn-primary { background: var(--content-primary); color: var(--content-primary-foreground); }
.documents-btn-primary:hover { background: color-mix(in srgb, var(--content-primary) 90%, black); color: var(--content-primary-foreground); }
a.documents-btn-link { text-decoration: none; }
a.documents-btn-link:hover { text-decoration: none; }
.documents-btn-outline { background: var(--content-background); color: var(--content-foreground); border: 1px solid var(--content-border); }
.documents-btn-outline:hover { background: var(--content-accent); color: var(--content-accent-foreground); border-color: var(--content-border); }
.documents-btn-outline:active:not(:disabled) { background: var(--content-secondary); }
.documents-btn-destructive { background: var(--content-destructive); color: var(--content-destructive-foreground); }
.documents-btn-destructive:hover { background: color-mix(in srgb, var(--content-destructive) 90%, black); color: var(--content-destructive-foreground); }
.documents-btn-sm { padding: 0.25rem 0.75rem; font-size: 0.8125rem; }
.documents-selection-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; padding: 1rem; margin-bottom: 1rem; background: var(--content-secondary); border-radius: 1rem; }
.documents-selection-count { font-weight: 500; }
.documents-table-card { background: var(--content-card); border: 1px solid var(--content-border); border-radius: 1rem; overflow: visible; position: relative; }
.documents-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; color: var(--content-muted-foreground); font-size: 0.875rem; }
.documents-spinner { width: 2.5rem; height: 2.5rem; border: 2px solid var(--content-border); border-top-color: var(--content-primary); border-radius: 50%; animation: documents-spin 0.8s linear infinite; margin-bottom: 1rem; }
@keyframes documents-spin { to { transform: rotate(360deg); } }
.documents-empty { text-align: center; padding: 4rem 2rem; }
.documents-empty-icon { color: var(--content-muted-foreground); margin-bottom: 1rem; }
.documents-empty-title { font-size: 1.25rem; font-weight: 600; color: var(--content-foreground); margin: 0 0 0.5rem; }
.documents-empty-text { font-size: 0.875rem; color: var(--content-muted-foreground); max-width: 24rem; margin: 0 auto; }
.documents-table { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 0.875rem; table-layout: auto; font-family: var(--font-sans); }
.documents-thead-row { background: oklch(0.93 0.015 80 / 0.5); border-bottom: 1px solid var(--content-border); }
.documents-th { text-align: left; font-weight: 500; padding: 0.75rem 0.5rem; height: 2.5rem; color: var(--content-foreground); vertical-align: middle; }
.documents-tr { transition: background-color 0.15s ease, color 0.15s ease; border-bottom: 1px solid var(--content-border); }
.documents-tr:last-child { border-bottom: none; }
.documents-tr:hover { background: var(--content-secondary); }
.documents-tr-highlighted { background: oklch(0.96 0.08 85); border-left: 4px solid var(--content-primary); }
.documents-td { padding: 0.75rem 0.5rem; vertical-align: middle; margin-top: 0.6rem; }
.documents-td-name { display: flex; align-items: center; gap: 0.75rem; }
.documents-file-icon { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
.documents-file-icon :deep(svg) { width: 20px; height: 20px; }
.documents-file-icon--PDF { color: #ef4444; }
.documents-file-icon--DOCX { color: #3b82f6; }
.documents-file-icon--XLSX { color: #22c55e; }
.documents-file-icon--OTHER { color: var(--content-muted-foreground); }
.documents-badge { display: inline-block; padding: 0.125rem 0.5rem; font-size: 0.75rem; font-weight: 500; background: var(--content-secondary); color: var(--content-foreground); border-radius: 9999px; }
.documents-td-muted { color: var(--content-muted-foreground); }
.documents-patient { display: flex; flex-direction: column; gap: 0; }
.documents-patient-name { font-weight: 500; }
.documents-patient-id { font-size: 0.75rem; color: var(--content-muted-foreground); }
.documents-th-checkbox, .documents-td-checkbox { width: 3rem; text-align: center; }
.documents-th-actions, .documents-td-actions { min-width: 2.5rem; width: 2.5rem; white-space: nowrap; overflow: visible; }
.documents-checkbox { width: 1rem; height: 1rem; min-width: 1rem; min-height: 1rem; cursor: pointer; -webkit-appearance: none; appearance: none; border: 1px solid var(--content-input); border-radius: 4px; background: var(--content-card); box-shadow: var(--content-shadow-xs); vertical-align: middle; transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease; }
.documents-checkbox:hover { border-color: var(--content-primary); }
.documents-checkbox:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--content-primary); }
.documents-checkbox:checked { background: var(--content-primary); border-color: var(--content-primary); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: center; background-size: 65%; }
.documents-checkbox:checked:hover { filter: brightness(0.95); }
.documents-row-menu-wrap { position: relative; overflow: visible; }
.documents-row-menu-btn { opacity: 0.7; }
.documents-tr:hover .documents-row-menu-btn { opacity: 1; }
.documents-row-menu { position: absolute; right: 0; top: 100%; margin-top: 2px; z-index: 100; min-width: 10rem; padding: 0.25rem; background: var(--content-card); border: 1px solid var(--content-border); border-radius: var(--content-radius); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.documents-row-menu-item { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; border: none; background: transparent; cursor: pointer; border-radius: 4px; color: var(--content-foreground); }
.documents-row-menu-item { transition: background-color 0.15s ease; }
.documents-row-menu-item:hover { background: var(--content-secondary); }
.documents-row-menu-item:active { background: var(--content-accent); }
.documents-row-menu-item-danger { color: var(--content-destructive); }
.documents-row-menu-item-danger:hover { background: rgba(220, 38, 38, 0.08); }
.documents-pagination { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-top: 1.5rem; }
.documents-pagination-text { font-size: 0.875rem; color: var(--content-muted-foreground); margin: 0; }
.documents-pagination-bold { font-weight: 500; color: var(--content-foreground); }
.documents-pagination-nav { display: flex; align-items: center; gap: 0.25rem; }
.documents-btn-pagination { min-width: 2rem; height: 2rem; transition: background-color 0.2s ease, color 0.2s ease; }
.documents-btn-pagination:not(.documents-btn-pagination-active):hover { background: var(--content-accent); color: var(--content-accent-foreground); }
.documents-btn-pagination:not(.documents-btn-pagination-active):active { background: var(--content-secondary); }
.documents-btn-pagination-active { background: var(--content-primary) !important; color: var(--content-primary-foreground) !important; }
.document-viewer-overlay { position: fixed; inset: 0; background: oklch(0 0 0 / 0.4); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.document-viewer-modal { background: var(--content-card); border-radius: var(--content-radius); width: 88%; max-width: 820px; max-height: 90vh; display: flex; flex-direction: column; border: 1px solid var(--content-border); box-shadow: 0 12px 48px oklch(0 0 0 / 0.15); }
.document-viewer-header { display: flex; justify-content: space-between; align-items: center; padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--content-border); }
.document-viewer-header h5 { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--content-foreground); }
.document-viewer-actions { display: flex; align-items: center; gap: 8px; }
.document-viewer-body { flex: 1; overflow: auto; padding: 1.25rem; background: var(--content-secondary); }
.document-viewer-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; }
.document-viewer-loading p { margin-top: 1rem; color: var(--content-muted-foreground); }
.docx-preview-container { width: 100%; overflow: auto; background: var(--content-secondary); border-radius: var(--content-radius); padding: 1.5rem; }
.document-info-banner { padding: 12px 16px; background: oklch(0.96 0.08 85 / 0.5); border: 1px solid var(--content-border); border-radius: 8px; margin-bottom: 1rem; font-size: 0.875rem; }
.document-preview-placeholder { text-align: center; padding: 2.5rem; }
.document-preview-placeholder :deep(svg) { width: 48px; height: 48px; margin-bottom: 1rem; }
.document-preview-placeholder h4 { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem; color: var(--content-foreground); }



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
