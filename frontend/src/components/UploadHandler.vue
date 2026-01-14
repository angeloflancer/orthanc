<script>
import {uppie} from "uppie"
import UploadReport from "./UploadReport.vue"
import api from "../orthancApi"

// Drop handler function to get all files
async function getAllFileEntries(dataTransferItemList) {
    let fileEntries = [];
    // Use BFS to traverse entire directory/file structure
    let queue = [];
    // Unfortunately dataTransferItemList is not iterable i.e. no forEach
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

// Get all the entries (files or sub-directories) in a directory by calling readEntries until it returns empty array
async function readAllDirectoryEntries(directoryReader) {
    let entries = [];
    let readEntries = await readEntriesPromise(directoryReader);
    while (readEntries.length > 0) {
        entries.push(...readEntries);
        readEntries = await readEntriesPromise(directoryReader);
    }
    return entries;
}

// Wrap readEntries in a promise to make working with readEntries easier
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

// Check if file is a Word document
function isWordFile(file) {
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    return fileName.endsWith('.doc') || 
           fileName.endsWith('.docx') ||
           mimeType.includes('word') ||
           mimeType.includes('msword') ||
           mimeType.includes('officedocument.wordprocessingml');
}

// Check if file is a DICOM file
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
            documentExpanded: false
        };
    },
    mounted() {
        uppie(document.querySelector("#filesUpload"), this.uppieUploadHandler);
        uppie(document.querySelector("#foldersUpload"), this.uppieUploadHandler);
        uppie(document.querySelector("#wordFilesUpload"), this.uppieWordUploadHandler);
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
                    
                    // Save DICOM study info to database
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
                        // Don't fail the upload if saving to DB fails
                    }
                }
            }
        },
        // Separate files into DICOM and Word files
        separateFiles(files) {
            const dicomFiles = [];
            const wordFiles = [];
            
            for (let file of files) {
                if (isWordFile(file)) {
                    wordFiles.push(file);
                } else if (isDicomFile(file) || file.name === "DICOMDIR") {
                    dicomFiles.push(file);
                } else {
                    // Try to detect by file extension or default to DICOM
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
            
            // Upload DICOM files
            if (dicomFiles.length > 0) {
                await this.uploadDicomFiles(dicomFiles);
            }
            
            // Handle Word files
            if (wordFiles.length > 0) {
                this.wordFilesToUpload = wordFiles;
                this.documentExpanded = true;
            }
        },
        toggleDicomSection() {
            this.dicomExpanded = !this.dicomExpanded;
        },
        toggleDocumentSection() {
            this.documentExpanded = !this.documentExpanded;
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
                errorMessages: {}
            };
            
            for (let file of files) {
                let filename = file.webkitRelativePath || file.name;
                if (file.name == "DICOMDIR") {
                    console.log("upload: skipping DICOMDIR file");
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
                    console.error('uploadDicomFiles', error);
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
                this.messageBus.emit('show-toast', 'No Word files to upload');
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
                isWordUpload: true
            };
            
            for (let file of this.wordFilesToUpload) {
                let filename = file.webkitRelativePath || file.name;
                try {
                    const uploadResponse = await api.uploadWordFile(file, this.wordPatientId.trim(), this.wordPatientName.trim());
                    
                    if (uploadResponse.success) {
                        this.lastUploadReports[uploadId].successFilesCount++;
                        this.lastUploadReports[uploadId].uploadedStudies[uploadResponse.wordFile.id] = {
                            type: 'word',
                            ...uploadResponse.wordFile
                        };
                    } else {
                        this.lastUploadReports[uploadId].failedFilesCount++;
                        this.lastUploadReports[uploadId].errorMessages[filename] = uploadResponse.error || "Upload failed";
                    }
                } catch (error) {
                    console.error('uploadWordFiles', error);
                    let errorMessage = "error " + (error.response?.status || 'unknown');
                    if (error.response?.status >= 400 && error.response?.status < 500) {
                        errorMessage = error.response.data?.error || errorMessage;
                    }
                    this.lastUploadReports[uploadId].failedFilesCount++;
                    this.lastUploadReports[uploadId].errorMessages[filename] = errorMessage;
                }
            }
            
            // Reset form
            this.wordFilesToUpload = [];
            this.wordPatientId = '';
            this.wordPatientName = '';
            this.documentExpanded = false;
            
            // Emit event to refresh Word file list if needed
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
                await this.uploadDicomFiles(dicomFiles);
            }
            
            const { wordFiles } = this.separateFiles(fileList);
            if (wordFiles.length > 0) {
                this.wordFilesToUpload = wordFiles;
                this.documentExpanded = true;
            }

            // reset input for next upload
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
                this.documentExpanded = true;
            }

            // reset input for next upload
            if (!this.singleUse) {
                document.getElementById('wordFilesUpload').value = null;
            }
        }
    },
    components: { UploadReport }
}
</script>

<template>
    <div>
        <div v-if="!disabledAfterUpload" class="upload-handler-drop-zone" :class="{'upload-handler-drop-zone-disabled': uploadDisabled}"  @drop="this.onDrop" @dragover="this.onDragOver" :disabled="uploadDisabled">
            <div v-if="uploadDisabled" class="upload-disabled-message mb-3">{{ uploadDisabledMessage }}</div>
            <div v-if="!uploadDisabled" class="upload-drag-text">Drop files here or</div>
            
            <!-- DICOM Upload Section -->
            <div class="upload-section-item">
                <div class="upload-section-header" @click="toggleDicomSection">
                    <span class="upload-section-title">Upload DICOM</span>
                </div>
                <div class="upload-section-content" :class="{'expanded': dicomExpanded}">
                    <div class="upload-buttons">
                        <label class="upload-btn" :class="{'disabled': uploadDisabled}">
                            <input :disabled="uploadDisabled" type="file" style="display: none;" id="foldersUpload" required
                                multiple directory webkitdirectory allowdirs>
                            <span>Select Folder</span>
                        </label>
                        <label class="upload-btn" :class="{'disabled': uploadDisabled}">
                            <input :disabled="uploadDisabled" type="file" style="display: none;" id="filesUpload" required multiple>
                            <span>Select Files</span>
                        </label>
                    </div>
                </div>
            </div>
            
            <!-- Document Upload Section -->
            <div class="upload-section-item">
                <div class="upload-section-divider"></div>
                <div class="upload-section-header" @click="toggleDocumentSection">
                    <span class="upload-section-title">Upload Document</span>
                </div>
                <div class="upload-section-content" :class="{'expanded': documentExpanded}">
                    <div v-if="wordFilesToUpload.length > 0" class="word-upload-form">
                        <div class="form-row">
                            <label class="form-label">Patient ID</label>
                            <input type="text" class="form-control" v-model="wordPatientId" placeholder="Patient ID" required>
                        </div>
                        <div class="form-row">
                            <label class="form-label">Patient Name</label>
                            <input type="text" class="form-control" v-model="wordPatientName" placeholder="Patient Name" required>
                        </div>
                        <div class="form-row">
                            <small class="text-muted">{{ wordFilesToUpload.length }} file(s) selected: {{ wordFilesToUpload.map(f => f.name).join(', ') }}</small>
                        </div>
                        <div class="form-actions">
                            <button class="upload-btn" @click="uploadWordFiles" :disabled="!wordPatientId.trim() || !wordPatientName.trim()">
                                Upload
                            </button>
                            <button class="upload-btn upload-btn-secondary" @click="cancelWordUpload">
                                Cancel
                            </button>
                        </div>
                    </div>
                    <div v-else class="upload-buttons">
                        <label class="upload-btn" :class="{'disabled': uploadDisabled}">
                            <input :disabled="uploadDisabled" type="file" style="display: none;" id="wordFilesUpload" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple>
                            <span>Select Files</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
        <div class="upload-report-list">
            <UploadReport v-for="(upload, key) in lastUploadReports" :report="upload" :key="key" :showStudyDetails="showStudyDetails" :disableCloseReport="disableCloseReport"
                @deletedUploadReport="onDeletedUploadReport"></UploadReport>
        </div>
    </div>
</template>
<style scoped>
.upload-report-list {
    display: flex;
    flex-direction: column-reverse;
}

.upload-handler-drop-zone {
    margin: 10px 15px;
    border-color: rgba(255, 255, 255, 0.3);
    border-style: solid;
    border-width: 1px;
    border-radius: 10px;
    background-color: var(--nav-side-bg-color-gradient-end, #2c3e50);
    color: var(--nav-side-color, #ffffff);
    padding: 15px;
}

.upload-handler-drop-zone-disabled {
    opacity: 0.6;
    border-color: #ff0000d2;
    cursor: not-allowed;
}

.upload-disabled-message {
    text-align: center;
    color: var(--nav-side-color, #ffffff);
}

.upload-drag-text {
    text-align: center;
    color: var(--nav-side-color, #ffffff);
    font-size: 14px;
    font-weight: 400;
    margin-bottom: 10px;
}

.upload-section-item {
    margin: 5px 0;
}

.upload-section-divider {
    height: 1px;
    background-color: rgba(255, 255, 255, 0.2);
    margin: 8px 0;
}

.upload-section-header {
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    padding: 6px 0;
    user-select: none;
}

.upload-section-title {
    font-weight: 400;
    font-size: 14px;
    color: var(--nav-side-color, #ffffff);
    text-align: center;
}

.upload-section-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
}

.upload-section-content.expanded {
    max-height: 500px;
    transition: max-height 0.3s ease-in;
}

.upload-buttons {
    display: flex;
    flex-direction: row;
    justify-content: center;
    gap: 8px;
    padding: 8px 0;
}

.upload-btn {
    background-color: transparent;
    border: none;
    color: var(--nav-side-color, #ffffff);
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    text-align: center;
    font-size: 12px;
    transition: all 0.2s ease;
    display: inline-block;
}

.upload-btn:hover:not(.disabled) {
    background-color: rgba(255, 255, 255, 0.15);
}

.upload-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.upload-btn-secondary {
    background-color: transparent;
}

.word-upload-form {
    padding: 10px 0;
}

.form-row {
    margin-bottom: 10px;
}

.form-label {
    display: block;
    color: var(--nav-side-color, #ffffff);
    font-size: 12px;
    margin-bottom: 4px;
    font-weight: 400;
}

.form-control {
    width: 100%;
    background-color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #333;
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 4px;
    box-sizing: border-box;
}

.form-control:focus {
    background-color: #fff;
    border-color: rgba(255, 255, 255, 0.5);
    outline: none;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
}

.form-actions {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 10px;
}

.text-muted {
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
}
</style>
