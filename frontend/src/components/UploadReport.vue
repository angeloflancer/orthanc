<script>
import Modal from "./Modal.vue"
import { mapState } from "vuex"

export default {
    props: {
        report: Object,
        showStudyDetails: Boolean,
        disableCloseReport: Boolean,
        isMostRecent: {
            type: Boolean,
            default: false
        }
    },
    emits: ["deletedUploadReport"],
    data() {
        return {
            showModal: true
        };
    },
    computed: {
        ...mapState({
            uiOptions: state => state.configuration.uiOptions,
        }),
        isUploadComplete() {
            const total = this.report.successFilesCount + this.report.skippedFilesCount + this.report.failedFilesCount;
            return total >= this.report.filesCount;
        },
        shouldShowModal() {
            // Only show modal for the most recent upload, or if upload is still in progress
            return this.isMostRecent || !this.isUploadComplete;
        },
        uploadStatus() {
            if (!this.isUploadComplete) {
                return null; // Still uploading
            }
            if (this.report.failedFilesCount > 0) {
                return 'partial'; // Some files failed
            }
            if (this.report.skippedFilesCount > 0 && this.report.successFilesCount === 0) {
                return 'skipped'; // All skipped
            }
            return 'success'; // All successful
        },
        uploadStatusMessage() {
            if (this.uploadStatus === 'success') {
                return `Upload completed successfully! ${this.report.successFilesCount} file(s) uploaded.`;
            } else if (this.uploadStatus === 'partial') {
                return `Upload completed with errors. ${this.report.successFilesCount} succeeded, ${this.report.failedFilesCount} failed.`;
            } else if (this.uploadStatus === 'skipped') {
                return `Upload completed. ${this.report.skippedFilesCount} file(s) skipped.`;
            }
            return null;
        },
        isDocumentUpload() {
            return this.report.isWordUpload || this.report.uploadType === 'document';
        },
        uploadTypeLabel() {
            return this.isDocumentUpload ? 'Document' : 'Study';
        },
        pctSuccess() {
            return 100.0 * this.report.successFilesCount / this.report.filesCount;
        },
        pctSkipped() {
            return 100.0 * this.report.skippedFilesCount / this.report.filesCount;
        },
        pctFailed() {
            return 100.0 * this.report.failedFilesCount / this.report.filesCount;
        },
        pctRemaining() {
            return 100.0 * (this.report.filesCount - (this.report.successFilesCount + this.report.skippedFilesCount + this.report.failedFilesCount) ) / this.report.filesCount;
        },
        progressSuccessText() {
            if (this.pctSuccess >= Math.max(this.pctRemaining, this.pctSkipped, this.pctFailed)) {
                return this.progressText;
            } else {
                return "";
            }
        },
        progressSkippedText() {
            if (this.pctSkipped > Math.max(this.pctRemaining, this.pctSuccess, this.pctFailed)) {
                return this.progressText;
            } else {
                return "";
            }
        },
        progressFailedText() {
            if (this.pctFailed > Math.max(this.pctRemaining, this.pctSkipped, this.pctSuccess)) {
                return this.progressText;
            } else {
                return "";
            }
        },
        progressRemainingText() {
            if (this.pctRemaining > Math.max(this.pctSuccess, this.pctSkipped, this.pctFailed)) {
                return this.progressText;
            } else {
                return "";
            }
        },
        progressText() {
            if (this.report.filesCount > 0) {
                return (this.report.successFilesCount + this.report.skippedFilesCount + this.report.failedFilesCount) + " / " + this.report.filesCount;
            }
        },
        uploadedStudiesCount() {
            return this.report.uploadedStudiesIds.size;
        },
        uploadedDocumentsCount() {
            if (this.isDocumentUpload) {
                return Object.keys(this.report.uploadedStudies).length;
            }
            return 0;
        }
    },
    methods: {
        close(reportId) {
            this.$emit("deletedUploadReport", reportId);
        },
        getStudyLine(studyId, studyMainDicomTags, patientMainDicomTags) {
            // format the line to display for each study
            let infos = [];

            for (let tag of this.uiOptions.UploadReportTags) {
                if (tag in studyMainDicomTags && studyMainDicomTags[tag] && studyMainDicomTags[tag].length > 0) {
                    infos.push(studyMainDicomTags[tag]);
                } else if (tag in patientMainDicomTags && patientMainDicomTags[tag] && patientMainDicomTags[tag].length > 0) {
                    infos.push(patientMainDicomTags[tag]);
                }
            }
            if (infos.length == 0) { // if nothing to display, display the study id
                infos.push(studyId.slice(0, 20) + "...");
            }   
            return infos.slice(0, this.uiOptions.UploadReportMaxTags).join(" - ");
        },
        getDocumentLine(doc) {
            if (doc.originalFileName) {
                return `${doc.originalFileName} (${doc.patientId})`;
            }
            return doc.fileName || 'Unknown document';
        }
    },
    watch: {
        isUploadComplete(newVal) {
            // Don't auto-close - let user close manually or via navigation
            // Modal will remain open to show status
        },
        '$route'(to, from) {
            // Close modal when navigating away (e.g., clicking a link in the modal or redirecting)
            if (from && this.showModal) {
                this.showModal = false;
            }
        },
        shouldShowModal(newVal) {
            // If shouldShowModal becomes true and upload is in progress, show the modal
            // This handles the case when user returns after navigation
            if (newVal && !this.isUploadComplete) {
                this.showModal = true;
            } else if (!newVal) {
                // If shouldShowModal is false, hide the modal
                this.showModal = false;
            }
        }
    },
    mounted() {
        // Only show modal initially if upload is in progress
        // Don't show for completed uploads that aren't the most recent
        if (this.isUploadComplete && !this.isMostRecent) {
            this.showModal = false;
        } else if (!this.isUploadComplete) {
            // Show modal if upload is in progress
            this.showModal = true;
        }
    },
    beforeUnmount() {
        // Ensure modal is closed when component is destroyed
        this.showModal = false;
    },
    components: { Modal }
}
</script>

<template>
    <div v-if="showModal && shouldShowModal" class="upload-progress-modal-overlay" @click.self="!disableCloseReport && close(report.id)">
        <div class="upload-progress-modal">
            <!-- Header -->
            <div class="upload-progress-modal-header">
                <div class="upload-progress-title">
                    <template v-if="isDocumentUpload">
                        Uploading document {{ report.filesCount }} {{ $t('files') }}
                    </template>
                    <template v-else>
                        {{ $t('upload') }} {{ report.filesCount }} {{ $t('files') }}
                    </template>
                </div>
                <button 
                    v-if="!disableCloseReport" 
                    type="button" 
                    class="upload-progress-close-btn" 
                    aria-label="Close"
                    @click="close(report.id)">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>

            <!-- Progress Section -->
            <div class="upload-progress-content">
                <div class="upload-progress-bar-container">
                    <div class="upload-progress-bar">
                        <div 
                            class="upload-progress-bar-fill upload-progress-success" 
                            :style="{ width: pctSuccess + '%' }"
                        ></div>
                        <div 
                            class="upload-progress-bar-fill upload-progress-skipped" 
                            :style="{ width: pctSkipped + '%' }"
                        ></div>
                        <div 
                            class="upload-progress-bar-fill upload-progress-failed" 
                            :style="{ width: pctFailed + '%' }"
                        ></div>
                    </div>
                    <div class="upload-progress-text">
                        {{ progressText }}
                    </div>
                </div>

                <!-- Error Messages Button -->
                <div v-if="Object.keys(report.errorMessages).length > 0" class="upload-progress-errors">
                    <button 
                        class="upload-progress-error-btn" 
                        type="button" 
                        data-bs-toggle="modal"
                        v-bind:data-bs-target="'#upload-errors-modal-' + this.report.id">
                        {{ $t('show_errors') }}
                    </button>
                    <Modal 
                        :id="'upload-errors-modal-' + this.report.id" 
                        :headerText="'Upload error report'"
                        :okText="'Close'" 
                        @ok="close($event)">
                        <template #modalBody>
                            <div class="error-report-wrapper">
                                <div class="error-report-summary">
                                    <svg class="error-summary-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    <div class="error-summary-text">
                                        <span class="error-summary-count">{{ Object.keys(report.errorMessages).length }}</span>
                                        <span class="error-summary-label">{{ Object.keys(report.errorMessages).length === 1 ? 'error found' : 'errors found' }}</span>
                                    </div>
                                </div>
                                <div class="error-report-container">
                                    <div 
                                        v-for="(error, file, index) in report.errorMessages" 
                                        :key="file"
                                        class="error-report-item"
                                        :style="{ animationDelay: (index * 0.05) + 's' }">
                                        <div class="error-report-file">
                                            <svg class="error-file-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M4 4C4 2.89543 4.89543 2 6 2H10.5858C10.851 2 11.1054 2.10536 11.2929 2.29289L15.7071 6.70711C15.8946 6.89464 16 7.149 16 7.41421V16C16 17.1046 15.1046 18 14 18H6C4.89543 18 4 17.1046 4 16V4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                                <path d="M10 2V6C10 6.55228 10.4477 7 11 7H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                            <span class="error-file-name">{{ file }}</span>
                                        </div>
                                        <div class="error-report-message">
                                            <svg class="error-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M8 6V10M8 12H8.01M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                            <span>{{ error }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </Modal>
                </div>

                <!-- Upload Status Message (when complete) -->
                <div v-if="isUploadComplete && uploadStatusMessage" class="upload-status-message" :class="'upload-status-' + uploadStatus">
                    <div class="upload-status-icon">
                        <svg v-if="uploadStatus === 'success'" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <svg v-else-if="uploadStatus === 'partial'" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="upload-status-text">{{ uploadStatusMessage }}</div>
                </div>

                <!-- Divider before uploaded items -->
                <div v-if="uploadStatusMessage && ((isDocumentUpload && uploadedDocumentsCount > 0) || (!isDocumentUpload && uploadedStudiesCount > 0))" 
                     class="upload-progress-divider"></div>

                <!-- Uploaded Items -->
                <div v-if="isDocumentUpload && uploadedDocumentsCount > 0" class="upload-progress-studies">
                    <div class="upload-progress-studies-label">Uploaded documents:</div>
                    <div class="upload-progress-studies-list">
                        <router-link 
                            v-for="(doc, docId) in report.uploadedStudies" 
                            :key="docId"
                            :to="doc.patientId ? `/word-files?patientId=${doc.patientId}&documentId=${docId}` : `/word-files?documentId=${docId}`" 
                            class="upload-progress-study-link"
                            @click="showModal = false">
                            {{ getDocumentLine(doc) }}
                        </router-link>
                    </div>
                </div>

                <div v-else-if="!isDocumentUpload && showStudyDetails && uploadedStudiesCount > 0" class="upload-progress-studies">
                    <div class="upload-progress-studies-label">{{ $t('uploaded_studies') }}:</div>
                    <div class="upload-progress-studies-list">
                        <router-link
                            v-for="(study, studyId) in report.uploadedStudies"
                            :key="studyId"
                            v-bind:to="'/filtered-studies?StudyInstanceUID=' + study.MainDicomTags['StudyInstanceUID'] + '&expand=study'"
                            class="upload-progress-study-link"
                            @click="showModal = false">
                            {{ this.getStudyLine(studyId, study.MainDicomTags, study.PatientMainDicomTags) }}
                        </router-link>
                    </div>
                </div>

                <div v-else-if="!isDocumentUpload && !showStudyDetails && uploadedStudiesCount > 0" class="upload-progress-studies">
                    <div class="upload-progress-studies-label">
                        {{ $t('uploaded_count_studies', {'count': uploadedStudiesCount }) }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<style scoped>
.upload-progress-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1050;
    padding: 20px;
    animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

.upload-progress-modal {
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
    from {
        transform: translateY(20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.upload-progress-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7eb;
    background: white;
}

.upload-progress-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    flex: 1;
}

.upload-progress-close-btn {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s ease;
    padding: 0;
}

.upload-progress-close-btn:hover {
    background: #f3f4f6;
    color: #111827;
}

.upload-progress-content {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
}

.upload-progress-bar-container {
    margin-bottom: 20px;
}

.upload-progress-bar {
    width: 100%;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    margin-bottom: 12px;
}

.upload-progress-bar-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    transition: width 0.3s ease;
    border-radius: 4px;
}

.upload-progress-bar-fill.upload-progress-success {
    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
    z-index: 3;
}

.upload-progress-bar-fill.upload-progress-skipped {
    background: #9ca3af;
    z-index: 2;
}

.upload-progress-bar-fill.upload-progress-failed {
    background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
    z-index: 1;
}

.upload-progress-text {
    text-align: center;
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
}

.upload-status-message {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-radius: 12px;
    margin-bottom: 20px;
    animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.upload-status-success {
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    border: 1px solid #10b981;
    color: #065f46;
}

.upload-status-partial {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b;
    color: #92400e;
}

.upload-status-skipped {
    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
    border: 1px solid #9ca3af;
    color: #374151;
}

.upload-status-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.upload-status-icon svg {
    width: 100%;
    height: 100%;
}

.upload-status-text {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
}

.upload-progress-errors {
    margin-bottom: 20px;
    display: flex;
    justify-content: center;
}

.upload-progress-error-btn {
    padding: 8px 16px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #374151;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.upload-progress-error-btn:hover {
    background: #e5e7eb;
    color: #111827;
}

.upload-progress-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 20px 0;
}

.upload-progress-studies {
    margin-top: 4px;
}

.upload-progress-studies-label {
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    margin-bottom: 12px;
}

.upload-progress-studies-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.upload-progress-study-link {
    font-size: 14px;
    color: #2563eb;
    text-decoration: none;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s ease;
    line-height: 1.5;
}

.upload-progress-study-link:hover {
    background: #eff6ff;
    color: #1d4ed8;
    text-decoration: none;
}

/* Error Report Modal Styles */
.error-report-wrapper {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.error-report-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border: 1px solid #fecaca;
    border-radius: 12px;
}

.error-summary-icon {
    flex-shrink: 0;
    color: #dc2626;
    width: 24px;
    height: 24px;
}

.error-summary-text {
    display: flex;
    align-items: baseline;
    gap: 8px;
}

.error-summary-count {
    font-size: 24px;
    font-weight: 700;
    color: #991b1b;
    line-height: 1;
}

.error-summary-label {
    font-size: 14px;
    font-weight: 500;
    color: #7f1d1d;
}

.error-report-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 50vh;
    overflow-y: auto;
    padding: 4px;
}

.error-report-item {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 12px;
    padding: 16px;
    transition: all 0.2s ease;
    animation: slideInError 0.3s ease-out;
}

@keyframes slideInError {
    from {
        opacity: 0;
        transform: translateX(-10px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.error-report-item:hover {
    background: #fee2e2;
    border-color: #fca5a5;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1);
}

.error-report-file {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #fecaca;
}

.error-file-icon {
    flex-shrink: 0;
    color: #dc2626;
    width: 20px;
    height: 20px;
}

.error-file-name {
    font-size: 14px;
    font-weight: 600;
    color: #991b1b;
    word-break: break-all;
    line-height: 1.4;
}

.error-report-message {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding-left: 30px;
}

.error-icon {
    flex-shrink: 0;
    color: #dc2626;
    width: 16px;
    height: 16px;
    margin-top: 2px;
}

.error-report-message span {
    font-size: 13px;
    color: #7f1d1d;
    line-height: 1.5;
    flex: 1;
}

/* Custom scrollbar for error container */
.error-report-container::-webkit-scrollbar {
    width: 6px;
}

.error-report-container::-webkit-scrollbar-track {
    background: #f3f4f6;
    border-radius: 3px;
}

.error-report-container::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
}

.error-report-container::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}

/* Responsive adjustments */
@media (max-width: 640px) {
    .upload-progress-modal {
        max-width: 100%;
        margin: 10px;
        border-radius: 12px;
    }

    .upload-progress-modal-header {
        padding: 16px 20px;
    }

    .upload-progress-content {
        padding: 20px;
    }

    .upload-progress-title {
        font-size: 16px;
    }
}
</style>
