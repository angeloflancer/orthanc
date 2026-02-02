<script>
import {uppie} from "uppie"
import UploadReport from "./UploadReport.vue"
import api from "../orthancApi"

// Drop handler function to get all files
async function getAllFileEntries(dataTransferItemList) {
    let fileEntries = [];
    let queue = [];
    for (let i = 0; i < dataTransferItemList.length; i++) {
        queue.push(dataTransferItemList[i].webkitGetAsEntry());
    }
    while (queue.length > 0) {
        let entry = queue.shift();
        if (entry.isFile) {
            fileEntries.push(entry);
        } else if (entry.isDirectory) {
            let reader = entry.createReader();
            queue.push(...await readAllDirectoryEntries(reader));
        }
    }
    return fileEntries;
}

async function getFileFromFileEntry(fileEntry) {
    try {
        return await new Promise((resolve, reject) => fileEntry.file(resolve, reject));
    } catch (err) {
        console.error('getFileFromFileEntry', err);
    }
}

async function getAllFiles(dataTransferItemList) {
    let fileEntries = await getAllFileEntries(dataTransferItemList);
    let files = [];
    for (let fileEntry of fileEntries) {
        files.push(await getFileFromFileEntry(fileEntry));
    }
    return files;
}

async function readAllDirectoryEntries(directoryReader) {
    let entries = [];
    let readEntries = await readEntriesPromise(directoryReader);
    while (readEntries.length > 0) {
        entries.push(...readEntries);
        readEntries = await readEntriesPromise(directoryReader);
    }
    return entries;
}

async function readEntriesPromise(directoryReader) {
    try {
        return await new Promise((resolve, reject) => {
            directoryReader.readEntries(resolve, reject);
        });
    } catch (err) {
        console.error('readEntriesPromise', err);
    }
}

function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    })
}

function isWordFile(file) {
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    return fileName.endsWith('.doc') || 
           fileName.endsWith('.docx') ||
           mimeType.includes('word') ||
           mimeType.includes('msword') ||
           mimeType.includes('officedocument.wordprocessingml');
}

function isDicomFile(file) {
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    return fileName.endsWith('.dcm') ||
           mimeType.includes('dicom') ||
           mimeType === 'application/octet-stream' && !isWordFile(file);
}

export default {
    props: ["showStudyDetails", "uploadDisabled", "uploadDisabledMessage", "singleUse", "disableCloseReport"],
    emits: ["uploadCompleted"],
    data() {
        return {
            uploadCounter: 0,
            lastUploadReports: {},
            disabledAfterUpload: false,
            // Word file upload fields
            wordPatientId: '',
            wordPatientName: '',
            wordFilesToUpload: [],
            // Collapsible states
            dicomExpanded: false,
            documentExpanded: false,
            // Document upload progress
            isUploadingDocument: false,
            documentUploadProgress: 0,
            // Patient modal
            showPatientModal: false,
            patientSearching: false,
            patientNotFound: false
        };
    },
    computed: {
        mostRecentUploadId() {
            const keys = Object.keys(this.lastUploadReports);
            if (keys.length === 0) return null;
            // Since uploadCounter increments, the highest numeric key is the most recent
            return Math.max(...keys.map(k => parseInt(k) || 0)).toString();
        }
    },
    mounted() {
        this.$nextTick(() => {
            const filesUpload = document.querySelector("#filesUpload");
            const foldersUpload = document.querySelector("#foldersUpload");
            const wordFilesUpload = document.querySelector("#wordFilesUpload");
            const wordFoldersUpload = document.querySelector("#wordFoldersUpload");
            
            if (filesUpload) uppie(filesUpload, this.uppieUploadHandler);
            if (foldersUpload) uppie(foldersUpload, this.uppieUploadHandler);
            if (wordFilesUpload) uppie(wordFilesUpload, this.uppieWordUploadHandler);
            if (wordFoldersUpload) uppie(wordFoldersUpload, this.uppieWordUploadHandler);
        });
    },
    methods: {
        onDrop(ev) {
            ev.preventDefault();
            getAllFiles(ev.dataTransfer.items).then((files) => {
                this.handleFiles(files);
            });
        },
        onDragOver(event) {
            event.preventDefault();
        },
        onDeletedUploadReport(uploadReportId) {
            delete this.lastUploadReports[uploadReportId];
        },
        async uploadedFile(uploadId, uploadedFileResponse) {
            let studyId = uploadedFileResponse["ParentStudy"];
            if (!this.lastUploadReports[uploadId].uploadedStudiesIds.has(studyId)) {
                this.lastUploadReports[uploadId].uploadedStudiesIds.add(studyId);
                
                if (this.showStudyDetails) {
                    const studyResponse = await api.getStudy(studyId);
                    this.lastUploadReports[uploadId].uploadedStudies[studyId] = studyResponse;
                    this.$store.dispatch('studies/addStudy', { study: studyResponse, studyId: studyId, reloadStats: true });
                    
                    try {
                        const studyInfo = {
                            studyInstanceUid: studyResponse.MainDicomTags?.StudyInstanceUID || '',
                            orthancStudyId: studyId,
                            patientId: studyResponse.PatientMainDicomTags?.PatientID || '',
                            patientName: studyResponse.PatientMainDicomTags?.PatientName || '',
                            patientBirthDate: studyResponse.PatientMainDicomTags?.PatientBirthDate || '',
                            patientSex: studyResponse.PatientMainDicomTags?.PatientSex || '',
                            studyDate: studyResponse.MainDicomTags?.StudyDate || '',
                            studyTime: studyResponse.MainDicomTags?.StudyTime || '',
                            studyDescription: studyResponse.MainDicomTags?.StudyDescription || '',
                            accessionNumber: studyResponse.MainDicomTags?.AccessionNumber || '',
                            referringPhysicianName: studyResponse.MainDicomTags?.ReferringPhysicianName || '',
                            modalitiesInStudy: studyResponse.RequestedTags?.ModalitiesInStudy || '',
                            seriesCount: studyResponse.Series?.length || 0,
                            instancesCount: studyResponse.RequestedTags?.NumberOfStudyRelatedInstances || 0
                        };
                        
                        if (studyInfo.studyInstanceUid && studyInfo.patientId) {
                            await api.saveDicomStudyInfo(studyInfo);
                        }
                    } catch (error) {
                        console.error('Error saving DICOM study info:', error);
                    }
                }
            }
        },
        separateFiles(files) {
            const dicomFiles = [];
            const wordFiles = [];
            
            for (let file of files) {
                if (isWordFile(file)) {
                    wordFiles.push(file);
                } else if (isDicomFile(file) || file.name === "DICOMDIR") {
                    dicomFiles.push(file);
                } else {
                    const fileName = file.name.toLowerCase();
                    if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
                        wordFiles.push(file);
                    } else {
                        dicomFiles.push(file);
                    }
                }
            }
            
            return { dicomFiles, wordFiles };
        },
        async handleFiles(files) {
            const { dicomFiles, wordFiles } = this.separateFiles(files);
            
            if (dicomFiles.length > 0) {
                // Proceed with upload (browser's native dialog already handled confirmation for folder uploads)
                await this.uploadDicomFiles(dicomFiles);
            }
            
            if (wordFiles.length > 0) {
                this.wordFilesToUpload = wordFiles;
                this.openPatientModal();
            }
        },
        toggleDicomSection() {
            if (this.dicomExpanded) {
                this.dicomExpanded = false;
            } else {
                this.dicomExpanded = true;
                this.documentExpanded = false; // Close document section
            }
        },
        toggleDocumentSection() {
            if (this.documentExpanded) {
                this.documentExpanded = false;
            } else {
                this.documentExpanded = true;
                this.dicomExpanded = false; // Close DICOM section
            }
        },
        triggerDicomUpload() {
            if (this.uploadDisabled) return;
            document.getElementById('filesUpload')?.click();
        },
        triggerDocumentUpload() {
            if (this.uploadDisabled) return;
            document.getElementById('wordFilesUpload')?.click();
        },
        openPatientModal() {
            this.showPatientModal = true;
            this.patientNotFound = false;
            this.wordPatientId = '';
            this.wordPatientName = '';
        },
        closePatientModal() {
            this.showPatientModal = false;
            this.wordFilesToUpload = [];
            this.wordPatientId = '';
            this.wordPatientName = '';
            this.patientNotFound = false;
        },
        async searchPatientById() {
            if (!this.wordPatientId.trim()) return;
            
            this.patientSearching = true;
            this.patientNotFound = false;
            
            try {
                const response = await api.getPatients();
                if (response.success && response.patients) {
                    const patient = response.patients.find(p => 
                        p.patientId.toLowerCase() === this.wordPatientId.trim().toLowerCase()
                    );
                    
                    if (patient) {
                        // Format patient name (convert DICOM format to readable)
                        this.wordPatientName = patient.patientName.replace(/\^/g, ', ').replace(/\s+/g, ' ').trim();
                        this.patientNotFound = false;
                    } else {
                        this.patientNotFound = true;
                    }
                } else {
                    this.patientNotFound = true;
                }
            } catch (error) {
                console.error('Error searching patient:', error);
                this.patientNotFound = true;
            } finally {
                this.patientSearching = false;
            }
        },
        handlePatientIdKeydown(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.searchPatientById();
            }
        },
        async confirmPatientAndUpload(event) {
            if (event.key && event.key !== 'Enter') return;
            if (!this.wordPatientId.trim() || !this.wordPatientName.trim()) {
                this.messageBus.emit('show-toast', 'Please enter Patient ID and Patient Name');
                return;
            }
            
            this.showPatientModal = false;
            await this.uploadWordFiles();
        },
        async uploadDicomFiles(files) {
            let uploadId = this.uploadCounter++;
            if (this.singleUse) {
                this.disabledAfterUpload = true;
            }

            this.lastUploadReports[uploadId] = {
                id: uploadId,
                filesCount: files.length,
                successFilesCount: 0,
                failedFilesCount: 0,
                skippedFilesCount: 0,
                uploadedStudiesIds: new Set(),
                uploadedStudies: {},
                errorMessages: {},
                isWordUpload: false
            };
            
            for (let file of files) {
                let filename = file.webkitRelativePath || file.name;
                if (file.name == "DICOMDIR") {
                    this.lastUploadReports[uploadId].skippedFilesCount++;
                    this.lastUploadReports[uploadId].errorMessages[filename] = "skipped";
                    continue;
                }
                const fileContent = await readFileAsync(file);
                try {
                    const uploadResponse = await api.uploadFile(fileContent);

                    if (Array.isArray(uploadResponse)) {
                        if (uploadResponse.length > 0) {
                            this.lastUploadReports[uploadId].successFilesCount++;
                            for (let uploadFileResponse of uploadResponse) {
                                this.uploadedFile(uploadId, uploadFileResponse);
                            }
                        } else {
                            this.lastUploadReports[uploadId].failedFilesCount++;
                            this.lastUploadReports[uploadId].errorMessages[filename] = "no valid DICOM files found in zip";
                        }
                    } else {
                        this.lastUploadReports[uploadId].successFilesCount++;
                        this.uploadedFile(uploadId, uploadResponse);
                    }
                }
                catch (error) {
                    let errorMessage = "error " + error.response?.status;
                    if (error.response?.status >= 400 && error.response?.status < 500) {
                        errorMessage = error.response.data?.Message || errorMessage;
                    }
                    this.lastUploadReports[uploadId].failedFilesCount++;
                    this.lastUploadReports[uploadId].errorMessages[filename] = errorMessage;
                }
            }

            this.$emit("uploadCompleted", this.lastUploadReports[uploadId].uploadedStudiesIds);
        },
        async uploadWordFiles() {
            if (!this.wordPatientId.trim() || !this.wordPatientName.trim()) {
                this.messageBus.emit('show-toast', 'Please enter Patient ID and Patient Name');
                return;
            }
            
            if (this.wordFilesToUpload.length === 0) {
                this.messageBus.emit('show-toast', 'No document files to upload');
                return;
            }
            
            let uploadId = this.uploadCounter++;
            if (this.singleUse) {
                this.disabledAfterUpload = true;
            }

            this.lastUploadReports[uploadId] = {
                id: uploadId,
                filesCount: this.wordFilesToUpload.length,
                successFilesCount: 0,
                failedFilesCount: 0,
                skippedFilesCount: 0,
                uploadedStudiesIds: new Set(),
                uploadedStudies: {},
                errorMessages: {},
                isWordUpload: true,
                uploadType: 'document'
            };
            
            this.isUploadingDocument = true;
            this.documentUploadProgress = 0;
            
            const totalFiles = this.wordFilesToUpload.length;
            let processedFiles = 0;
            
            for (let file of this.wordFilesToUpload) {
                let filename = file.webkitRelativePath || file.name;
                try {
                    const uploadResponse = await api.uploadWordFile(file, this.wordPatientId.trim(), this.wordPatientName.trim());
                    
                    if (uploadResponse.success) {
                        this.lastUploadReports[uploadId].successFilesCount++;
                        this.lastUploadReports[uploadId].uploadedStudies[uploadResponse.wordFile.id] = {
                            type: 'document',
                            ...uploadResponse.wordFile
                        };
                    } else {
                        this.lastUploadReports[uploadId].failedFilesCount++;
                        this.lastUploadReports[uploadId].errorMessages[filename] = uploadResponse.error || "Upload failed";
                    }
                } catch (error) {
                    let errorMessage = "error " + (error.response?.status || 'unknown');
                    if (error.response?.status >= 400 && error.response?.status < 500) {
                        errorMessage = error.response.data?.error || errorMessage;
                    }
                    this.lastUploadReports[uploadId].failedFilesCount++;
                    this.lastUploadReports[uploadId].errorMessages[filename] = errorMessage;
                }
                
                processedFiles++;
                this.documentUploadProgress = Math.round((processedFiles / totalFiles) * 100);
            }
            
            this.isUploadingDocument = false;
            this.documentUploadProgress = 0;
            
            if (this.lastUploadReports[uploadId].successFilesCount > 0) {
                this.messageBus.emit('show-toast', `Successfully uploaded ${this.lastUploadReports[uploadId].successFilesCount} document(s)`);
            }
            if (this.lastUploadReports[uploadId].failedFilesCount > 0) {
                this.messageBus.emit('show-toast', `Failed to upload ${this.lastUploadReports[uploadId].failedFilesCount} document(s)`);
            }
            
            this.wordFilesToUpload = [];
            this.wordPatientId = '';
            this.wordPatientName = '';
            this.documentExpanded = false;
            
            this.$emit("uploadCompleted", new Set());
        },
        cancelWordUpload() {
            this.wordFilesToUpload = [];
            this.wordPatientId = '';
            this.wordPatientName = '';
            this.documentExpanded = false;
        },
        async uppieUploadHandler(event, formData, files) {
            const fileList = Array.from(event.target.files);
            const { dicomFiles } = this.separateFiles(fileList);
            if (dicomFiles.length > 0) {
                // Browser's native dialog already handled confirmation, proceed with upload
                await this.uploadDicomFiles(dicomFiles);
            }
            
            const { wordFiles } = this.separateFiles(fileList);
            if (wordFiles.length > 0) {
                this.wordFilesToUpload = wordFiles;
                this.openPatientModal();
            }

            if (!this.singleUse) {
                document.getElementById('filesUpload').value = null;
                document.getElementById('foldersUpload').value = null;
            }
        },
        async uppieWordUploadHandler(event, formData, files) {
            const fileList = Array.from(event.target.files);
            const { wordFiles } = this.separateFiles(fileList);
            if (wordFiles.length > 0) {
                this.wordFilesToUpload = wordFiles;
                this.openPatientModal();
            }

            if (!this.singleUse) {
                const wordFilesInput = document.getElementById('wordFilesUpload');
                const wordFoldersInput = document.getElementById('wordFoldersUpload');
                if (wordFilesInput) wordFilesInput.value = null;
                if (wordFoldersInput) wordFoldersInput.value = null;
            }
        },
        async handleWordFilesChange(event) {
            // Native change handler as fallback for uppie (in case uppie doesn't fire after reset)
            const fileList = Array.from(event.target.files || []);
            if (fileList.length > 0) {
                const { wordFiles } = this.separateFiles(fileList);
                if (wordFiles.length > 0 && !this.showPatientModal) {
                    // Only open modal if it's not already open (prevent duplicate calls)
                    this.wordFilesToUpload = wordFiles;
                    this.openPatientModal();
                }
            }
            
            // Reset input value after processing to allow selecting same files again
            // Use setTimeout to ensure the change event completes first
            if (!this.singleUse) {
                setTimeout(() => {
                    if (event.target) {
                        event.target.value = null;
                    }
                }, 0);
            }
        }
    },
    components: { UploadReport }
}
</script>

<template>
    <div class="upload-modern">
        <div v-if="!disabledAfterUpload" class="upload-modern-wrapper" :class="{'upload-modern-disabled': uploadDisabled}">
            <!-- Drop zone (modern project style) -->
            <div
                class="upload-drop-zone"
                :class="{'upload-drop-zone-disabled': uploadDisabled}"
                @drop="onDrop"
                @dragover="onDragOver"
            >
                <input type="file" style="display: none;" id="foldersUpload" required multiple directory webkitdirectory allowdirs>
                <input type="file" style="display: none;" id="filesUpload" required multiple>
                <input type="file" style="display: none;" id="wordFilesUpload"
                    accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    multiple @change="handleWordFilesChange">

                <div v-if="uploadDisabled" class="upload-disabled-message">{{ uploadDisabledMessage }}</div>
                <template v-else>
                    <svg class="upload-drop-icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><polyline points="12 11 12 17"/><line x1="9" x2="15" y1="14" y2="14"/></svg>
                    <p class="upload-drop-hint">Drop files here or</p>
                    <button type="button" class="upload-dicom-btn" @click="triggerDicomUpload">Upload DICOM</button>
                    <div class="upload-links">
                        <label class="upload-link" for="foldersUpload">Select Folder</label>
                        <span class="upload-link-sep">·</span>
                        <label class="upload-link" for="filesUpload">Select Files</label>
                    </div>
                </template>
            </div>
            <!-- Upload Document button -->
            <button type="button" class="upload-document-btn" :disabled="uploadDisabled" @click="triggerDocumentUpload">
                Upload Document
            </button>
        </div>
        
        <!-- Patient Info Modal -->
        <div v-if="showPatientModal" class="patient-modal-overlay" @click.self="closePatientModal">
            <div class="patient-modal">
                <div class="patient-modal-header">
                    <h5>Patient Information</h5>
                    <button class="patient-modal-close" @click="closePatientModal">&times;</button>
                </div>
                <div class="patient-modal-body">
                    <p class="files-info">{{ wordFilesToUpload.length }} file(s) selected</p>
                    
                    <div class="form-group">
                        <label>Patient ID</label>
                        <div class="input-with-action">
                            <input 
                                type="text" 
                                v-model="wordPatientId" 
                                placeholder="Enter Patient ID and press Enter"
                                @keydown="handlePatientIdKeydown"
                                :disabled="patientSearching"
                            >
                            <span v-if="patientSearching" class="spinner-border spinner-border-sm"></span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Patient Name</label>
                        <input 
                            type="text" 
                            v-model="wordPatientName" 
                            @keydown="confirmPatientAndUpload"
                            placeholder="Enter Patient Name"
                        >
                    </div>
                    
                    <div v-if="patientNotFound" class="patient-not-found">
                        <i class="bi bi-exclamation-circle"></i>
                        Can't find patient. Please enter name manually.
                    </div>
                </div>
                <div class="patient-modal-footer">
                    <button class="btn-cancel" @click="closePatientModal">Cancel</button>
                    <button 
                        class="btn-confirm" 
                        @click="confirmPatientAndUpload"
                        :disabled="!wordPatientId.trim() || !wordPatientName.trim()"
                    >
                        Upload
                    </button>
                </div>
            </div>
        </div>
        
        <div class="upload-report-list">
            <UploadReport 
                v-for="(upload, key) in lastUploadReports" 
                :report="upload" 
                :key="key" 
                :showStudyDetails="showStudyDetails" 
                :disableCloseReport="disableCloseReport"
                :isMostRecent="key === mostRecentUploadId"
                @deletedUploadReport="onDeletedUploadReport">
            </UploadReport>
        </div>
    </div>
</template>

<style scoped>
.upload-report-list {
    display: flex;
    flex-direction: column-reverse;
}

/* Modern project upload form style - match exactly */
.upload-modern {
    margin: 0;
    font-family: 'Geist', 'Geist Fallback', system-ui, sans-serif;
    font-size: 0.875rem;
}

.upload-modern-wrapper {
    padding: 1rem;
    background: #0f0c0a;
    border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.2));
    border-radius: 0.5rem;
    color: var(--sidebar-foreground, #fff);
}

.upload-modern-disabled {
    opacity: 0.6;
    pointer-events: none;
}

/* Inner drop zone - dark gray #282828, dashed border (modern project) */
.upload-drop-zone {
    border: 2px dashed var(--sidebar-border, rgba(255, 255, 255, 0.25));
    border-radius: 0.5rem;
    padding: 1rem;
    text-align: center;
    margin-bottom: 0.75rem;
    background: transparent;
    cursor: pointer;
}

.upload-drop-zone-disabled {
    cursor: not-allowed;
    border-color: #ef4444;
}

.upload-disabled-message {
    text-align: center;
    color: var(--sidebar-foreground);
    font-size: 0.875rem;
}

/* Folder with upward arrow icon - light gray */
.upload-drop-icon {
    width: 32px;
    height: 32px;
    margin: 0 auto 0.5rem;
    display: block;
    opacity: 0.5;
    color: var(--sidebar-foreground, #fff);
}

.upload-drop-hint {
    font-size: 0.875rem;
    color: var(--sidebar-foreground, #fff);
    opacity: 0.7;
    margin: 0 0 0.5rem;
}

/* Upload DICOM button - slightly lighter dark gray bg, white bold text, gently rounded (modern project) */
.upload-dicom-btn {
    display: inline-block;
    padding: 0.375rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #ffffff;
    background: #181513;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    margin: 0.5rem 0 0.75rem;
    transition: background 0.15s;
}

.upload-dicom-btn:hover {
    background: #4a4a4a;
}

/* Select Folder / Select Files - light gray, underlined, gap-4 (modern project) */
.upload-links {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    font-size: 0.75rem;
}

.upload-link {
    color: var(--sidebar-foreground, #fff);
    opacity: 0.7;
    text-decoration: underline;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
}

.upload-link:hover {
    opacity: 1;
}

.upload-link-sep {
    opacity: 0.5;
    color: var(--sidebar-foreground, #fff);
}

.upload-document-btn {
    width: 100%;
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-foreground, #fff);
    background: transparent;
    border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.2));
    border-radius: 9999px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}

.upload-document-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
}

.upload-document-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Document upload progress styles */
.document-upload-progress {
    padding: 15px 10px;
}

.progress-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
}

.progress-label {
    font-size: 12px;
    color: var(--nav-side-color, #ffffff);
}

.progress-percent {
    font-size: 12px;
    color: var(--nav-side-color, #ffffff);
    font-weight: 500;
}

.progress-bar-container {
    width: 100%;
    height: 6px;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    overflow: hidden;
}

.progress-bar-fill {
    height: 100%;
    background-color: #4a90e2;
    border-radius: 3px;
    transition: width 0.3s ease;
}

/* Patient Modal Styles */
.patient-modal-overlay {
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

.patient-modal {
    background: white;
    border-radius: 12px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    overflow: hidden;
}

.patient-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #eee;
}

.patient-modal-header h5 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
}

.patient-modal-close {
    background: none;
    border: none;
    font-size: 24px;
    color: #999;
    cursor: pointer;
    padding: 0;
    line-height: 1;
}

.patient-modal-close:hover {
    color: #333;
}

.patient-modal-body {
    padding: 20px;
}

.files-info {
    font-size: 13px;
    color: #666;
    margin-bottom: 16px;
    padding: 8px 12px;
    background: #f8f9fa;
    border-radius: 6px;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #555;
    margin-bottom: 6px;
}

.form-group input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}

.input-with-action {
    position: relative;
    display: flex;
    align-items: center;
}

.input-with-action input {
    padding-right: 36px;
}

.input-with-action .spinner-border {
    position: absolute;
    right: 12px;
    width: 16px;
    height: 16px;
    color: #4a90e2;
}

.patient-not-found {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 8px;
    font-size: 13px;
    color: #856404;
}

.patient-not-found i {
    font-size: 16px;
}

.patient-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid #eee;
    background: #f8f9fa;
}

.btn-cancel {
    padding: 8px 20px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-cancel:hover {
    background: #f0f0f0;
}

.btn-confirm {
    padding: 8px 20px;
    border: none;
    background: #4a90e2;
    color: white;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-confirm:hover:not(:disabled) {
    background: #357abd;
}

.btn-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
