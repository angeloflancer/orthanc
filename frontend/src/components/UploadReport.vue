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
            // Auto-close modal after 3 seconds when upload completes (if not disabled)
            if (newVal && !this.disableCloseReport) {
                setTimeout(() => {
                    if (this.showModal) {
                        this.close(this.report.id);
                    }
                }, 3000);
            }
        },
        '$route'(to, from) {
            // Close modal when navigating away (e.g., clicking a link in the modal)
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
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th width="50%">{{ $t('file') }}</th>
                                        <th width="50%">{{ $t('error') }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(error, file) in report.errorMessages" :key="error">
                                        <td>{{ file }}</td>
                                        <td class="text-right">{{ error }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </template>
                    </Modal>
                </div>

                <!-- Divider -->
                <div v-if="(isDocumentUpload && uploadedDocumentsCount > 0) || (!isDocumentUpload && uploadedStudiesCount > 0)" 
                     class="upload-progress-divider"></div>

                <!-- Uploaded Items -->
                <div v-if="isDocumentUpload && uploadedDocumentsCount > 0" class="upload-progress-studies">
                    <div class="upload-progress-studies-label">Uploaded documents:</div>
                    <div class="upload-progress-studies-list">
                        <router-link 
                            v-for="(doc, docId) in report.uploadedStudies" 
                            :key="docId"
                            to="/word-files" 
                            class="upload-progress-study-link">
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
                            class="upload-progress-study-link">
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
