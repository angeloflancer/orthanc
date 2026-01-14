<script>
import WordFileItem from "./WordFileItem.vue"
import Toasts from "./Toasts.vue"
import api from "../orthancApi"

export default {
    name: 'WordFileList',
    components: { WordFileItem, Toasts },
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
            filterUploadedBy: ''
        };
    },
    async created() {
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
        async deleteWordFile(id) {
            if (!confirm('Are you sure you want to delete this Word file?')) {
                return;
            }
            
            try {
                await api.deleteWordFile(id);
                this.wordFiles = this.wordFiles.filter(file => file.id !== id);
                this.messageBus.emit('show-toast', 'Word file deleted successfully');
            } catch (error) {
                console.error('Error deleting word file:', error);
                this.messageBus.emit('show-toast', 'Failed to delete Word file');
            }
        },
        async deleteSelectedWordFiles() {
            if (this.selectedWordFileIds.length === 0) {
                return;
            }
            
            if (!confirm(`Are you sure you want to delete ${this.selectedWordFileIds.length} selected file(s)?`)) {
                return;
            }
            
            try {
                for (const id of this.selectedWordFileIds) {
                    await api.deleteWordFile(id);
                }
                this.wordFiles = this.wordFiles.filter(file => !this.selectedWordFileIds.includes(file.id));
                this.selectedWordFileIds = [];
                this.messageBus.emit('show-toast', 'Selected files deleted successfully');
            } catch (error) {
                console.error('Error deleting word files:', error);
                this.messageBus.emit('show-toast', 'Failed to delete some files');
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
                this.messageBus.emit('show-toast', 'Failed to view Word file');
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
                this.messageBus.emit('show-toast', 'Failed to download Word file');
            }
        },
        async downloadSelectedWordFiles() {
            if (this.selectedWordFileIds.length === 0) {
                return;
            }
            
            try {
                for (const id of this.selectedWordFileIds) {
                    await this.downloadWordFile(id);
                    // Small delay to avoid browser blocking multiple downloads
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                this.messageBus.emit('show-toast', 'Download started for selected files');
            } catch (error) {
                console.error('Error downloading word files:', error);
                this.messageBus.emit('show-toast', 'Failed to download some files');
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
                this.messageBus.emit('show-toast', 'Failed to print Word file');
            }
        },
        async printSelectedWordFiles() {
            if (this.selectedWordFileIds.length === 0) {
                return;
            }
            
            try {
                for (const id of this.selectedWordFileIds) {
                    await this.printWordFile(id);
                    // Small delay between prints
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error('Error printing word files:', error);
                this.messageBus.emit('show-toast', 'Failed to print some files');
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
                    <th width="25%" class="study-table-title" scope="col">File Name</th>
                    <th width="15%" class="study-table-title" scope="col">Patient ID</th>
                    <th width="20%" class="study-table-title" scope="col">Patient Name</th>
                    <th width="15%" class="study-table-title" scope="col">Uploaded By</th>
                    <th width="12%" class="study-table-title" scope="col">Uploaded At</th>
                    <th width="10%" class="study-table-title" scope="col">Actions</th>
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
            <tbody v-if="!loading && filteredWordFiles.length === 0">
                <tr>
                    <td colspan="7" class="text-center text-muted" style="padding: 20px;">
                        No documents found
                    </td>
                </tr>
            </tbody>
            <WordFileItem
                v-for="wordFile in filteredWordFiles"
                :key="wordFile.id"
                :wordFile="wordFile"
                :selected="selectedWordFileIds.includes(wordFile.id)"
                @selected="onWordFileSelected"
                @view="viewWordFile"
                @download="downloadWordFile"
                @delete="deleteWordFile"
                @print="printWordFile"
            />
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
</style>
