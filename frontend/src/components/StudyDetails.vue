<script>
import SeriesItem from "./SeriesItem.vue"
import SeriesList from "./SeriesList.vue";
import { mapState, mapGetters } from "vuex"
import ResourceButtonGroup from "./ResourceButtonGroup.vue";
import ResourceDetailText from "./ResourceDetailText.vue";
import AuditLogs from "./AuditLogs.vue";
import api from "../orthancApi";
import LabelsEditor from "./LabelsEditor.vue";
import SourceType from '../helpers/source-type';

export default {
    props: ['studyId', 'studyMainDicomTags', 'patientMainDicomTags', 'labels'],
    emits: ["deletedStudy"],
    setup() {
    },
    data() {
        return {
            samePatientStudiesCount: 0,
            studySeries: [],
            hasLoadedSamePatientsStudiesCount: false,
            allLabelsLocalCopy: new Set(),
            studyMainDicomTagsLocalCopy: {},
            remoteStudyFoundLocally: false,
            labelsComponentKey: 0,
            copiedField: null
        };
    },
    async created() {
        this.allLabelsLocalCopy = await api.loadAllLabels();
        this.messageBus.on('added-series-to-study-' + this.studyId, this.reloadSeriesList);
    },
    async mounted() {
        this.samePatientStudiesCount = (await api.getSamePatientStudies(this.patientMainDicomTags, this.uiOptions.ShowSamePatientStudiesFilter)).length;
        this.studyMainDicomTagsLocalCopy = {...this.studyMainDicomTags};
        await this.reloadSeriesList();
        this.hasLoadedSamePatientsStudiesCount = true;

        if (this.studiesSourceType == SourceType.REMOTE_DICOM || this.studiesSourceType == SourceType.REMOTE_DICOM_WEB) {
            this.remoteStudyFoundLocally = (await api.studyExists(this.studyMainDicomTagsLocalCopy.StudyInstanceUID));
        }

        if (this.studiesSourceType == SourceType.LOCAL_ORTHANC) {
            for (const t of this.uiOptions.StudyMainTags) {
                if (!(t in this.studyMainDicomTagsLocalCopy) && ['VisitComments'].includes(t)) {
                    console.info("Possibly missing tag from DB: " + t + ", will get it from an instance");
                    let instances = await api.getStudyInstancesIds(this.studyId);
                    let instanceTags = await api.getInstanceTags(instances[0]);
                    for (const [k, v] of Object.entries(instanceTags)) {
                        if (v['Name'] == t) {
                            this.studyMainDicomTagsLocalCopy[t] = v['Value'];
                        }
                    }
                }
            }
        }
    },
    computed: {
        ...mapState({
            uiOptions: state => state.configuration.uiOptions,
            allLabels: state => state.labels.allLabels,
            studiesSourceType: state => state.studies.sourceType,
            studiesRemoteSource: state => state.studies.remoteSource,
        }),
        showLabels() {
            if (this.studiesSourceType == SourceType.LOCAL_ORTHANC) {
                return true;
            } else {
                return false;
            }
        },
        samePatientStudiesLink() {
            let filters = [];
            for (let tag of this.uiOptions.ShowSamePatientStudiesFilter) {
                if (tag in this.patientMainDicomTags) {
                    if (["PatientBirthDate"].indexOf(tag) >= 0) {
                        filters.push(tag + "=" + this.patientMainDicomTags[tag] + "");
                    } else {
                        filters.push(tag + "=\"" + this.patientMainDicomTags[tag] + "\"");
                    }
                }
            }
            return "/filtered-studies?" + filters.join('&');
        },
        isLocalOrthanc() {
            return this.studiesSourceType == SourceType.LOCAL_ORTHANC;
        },
        isRemoteSource() {
            return this.studiesSourceType == SourceType.REMOTE_DICOM || this.studiesSourceType == SourceType.REMOTE_DICOM_WEB;
        },
        sameLocalStudyLink() {
            return "/filtered-studies?StudyInstanceUID=" + this.studyMainDicomTagsLocalCopy.StudyInstanceUID;
        },
        // Study info fields
        studyInfoFields() {
            return [
                { key: 'StudyDate', label: 'Study Date', value: this.formatDate(this.studyMainDicomTagsLocalCopy.StudyDate) },
                { key: 'StudyTime', label: 'Study Time', value: this.studyMainDicomTagsLocalCopy.StudyTime || '' },
                { key: 'StudyDescription', label: 'Study Description', value: this.studyMainDicomTagsLocalCopy.StudyDescription || '' },
                { key: 'AccessionNumber', label: 'Accession Number', value: this.studyMainDicomTagsLocalCopy.AccessionNumber || '' },
                { key: 'StudyID', label: 'Study ID', value: this.studyMainDicomTagsLocalCopy.StudyID || '' },
                { key: 'StudyInstanceUID', label: 'Study Instance UID', value: this.studyMainDicomTagsLocalCopy.StudyInstanceUID || '' },
                { key: 'RequestingPhysician', label: 'Requesting Physician', value: this.studyMainDicomTagsLocalCopy.RequestingPhysician || '' },
                { key: 'ReferringPhysicianName', label: 'Referring Physician Name', value: this.studyMainDicomTagsLocalCopy.ReferringPhysicianName || '' },
                { key: 'InstitutionName', label: 'Institution Name', value: this.studyMainDicomTagsLocalCopy.InstitutionName || '' }
            ];
        },
        patientInfoFields() {
            return [
                { key: 'PatientID', label: 'Patient ID', value: this.patientMainDicomTags?.PatientID || '' },
                { key: 'PatientName', label: 'Patient Name', value: this.formatPatientName(this.patientMainDicomTags?.PatientName) },
                { key: 'PatientBirthDate', label: 'Patient Birth Date', value: this.formatDate(this.patientMainDicomTags?.PatientBirthDate) },
                { key: 'PatientSex', label: 'Patient Sex', value: this.patientMainDicomTags?.PatientSex || '' }
            ];
        }
    },
    watch: {
        allLabels(newValue, oldValue) {
            this.labelsComponentKey++;
        }
    },
    components: { SeriesItem, SeriesList, ResourceButtonGroup, ResourceDetailText, LabelsEditor, AuditLogs },
    methods: {
        onDeletedStudy() {
            this.$emit("deletedStudy", this.studyId);
        },
        async reloadSeriesList() {
            if (this.studiesSourceType == SourceType.LOCAL_ORTHANC) {
                this.studySeries = (await api.getStudySeries(this.studyId));
            } else if (this.studiesSourceType == SourceType.REMOTE_DICOM) {
                let remoteSeries = (await api.remoteDicomFind("Series", this.studiesRemoteSource, {
                    "StudyInstanceUID": this.studyMainDicomTagsLocalCopy.StudyInstanceUID,
                    "PatientID": this.patientMainDicomTags.PatientID,
                    "NumberOfSeriesRelatedInstances": "",
                    "Modality": "",
                    "SeriesDescription": "",
                    "SeriesNumber": ""
                    },
                    false));
                this.studySeries = remoteSeries.map(s => { return {
                    "ID": s["SeriesInstanceUID"],
                    "MainDicomTags": s
                }})
            } else if (this.studiesSourceType == SourceType.REMOTE_DICOM_WEB) {
                let remoteSeries = (await api.qidoRs("Series", this.studiesRemoteSource, {
                    "StudyInstanceUID": this.studyMainDicomTagsLocalCopy.StudyInstanceUID,
                    "NumberOfSeriesRelatedInstances": "",
                    "Modality": "",
                    "SeriesDescription": "",
                    "SeriesNumber": "",
                    "SeriesDate": "",
                    "SeriesTime": "",
                    "BodyPartExamined": "",
                    "ProtocolName": ""
                },
                    false));
                this.studySeries = remoteSeries.map(s => { return {
                    "ID": s["SeriesInstanceUID"],
                    "MainDicomTags": s
                }})
            }
        },
        formatDate(dateString) {
            if (!dateString) return '';
            if (dateString.length === 8 && !dateString.includes('-')) {
                return `${dateString.substring(0, 4)}-${dateString.substring(4, 6)}-${dateString.substring(6, 8)}`;
            }
            return dateString;
        },
        formatPatientName(name) {
            if (!name) return '';
            return name.replace(/\^/g, ', ').replace(/\s+/g, ' ').trim();
        },
        async copyToClipboard(value, key) {
            if (!value) return;
            try {
                await navigator.clipboard.writeText(value);
                this.copiedField = key;
                setTimeout(() => {
                    this.copiedField = null;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    }
}
</script>


<template>
    <div class="study-details-container">
        <!-- Modern Details Grid -->
        <div class="details-content">
            <div class="details-grid">
                <!-- Study Info -->
                <div class="info-section">
                    <h6><i class="bi bi-clipboard2-pulse me-2"></i>Study Information</h6>
                    <div class="info-row" v-for="field in studyInfoFields" :key="field.key">
                        <span class="info-label">{{ field.label }}:</span>
                        <span class="info-value" :class="{ 'uid-text': field.key.includes('UID') }">
                            {{ field.value || '-' }}
                        </span>
                        <button 
                            v-if="field.value" 
                            class="copy-btn" 
                            @click="copyToClipboard(field.value, field.key)"
                            :title="copiedField === field.key ? 'Copied!' : 'Copy'"
                        >
                            <i :class="copiedField === field.key ? 'bi bi-check' : 'bi bi-clipboard'"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Patient Info -->
                <div class="info-section">
                    <h6><i class="bi bi-person-fill me-2"></i>Patient Information</h6>
                    <div class="info-row" v-for="field in patientInfoFields" :key="field.key">
                        <span class="info-label">{{ field.label }}:</span>
                        <span class="info-value">{{ field.value || '-' }}</span>
                        <button 
                            v-if="field.value" 
                            class="copy-btn" 
                            @click="copyToClipboard(field.value, field.key)"
                            :title="copiedField === field.key ? 'Copied!' : 'Copy'"
                        >
                            <i :class="copiedField === field.key ? 'bi bi-check' : 'bi bi-clipboard'"></i>
                        </button>
                    </div>
                    
                    <!-- Same patient studies info -->
                    <div v-if="isLocalOrthanc && hasLoadedSamePatientsStudiesCount && samePatientStudiesCount > 1" class="patient-studies-info">
                        <i class="bi bi-info-circle me-1"></i>
                        {{ $t('this_patient_has_other_studies', { count: samePatientStudiesCount }) }}.
                        <router-link :to='samePatientStudiesLink'>{{ $t('this_patient_has_other_studies_show') }}</router-link>
                    </div>
                    <div v-if="isLocalOrthanc && hasLoadedSamePatientsStudiesCount && samePatientStudiesCount == 1" class="patient-studies-info">
                        <i class="bi bi-check-circle me-1"></i>
                        {{ $t('this_patient_has_no_other_studies') }}
                    </div>
                    <div v-if="isRemoteSource && hasLoadedSamePatientsStudiesCount && samePatientStudiesCount > 1" class="patient-studies-info">
                        <i class="bi bi-info-circle me-1"></i>
                        {{ $t('this_remote_patient_has_local_studies', { count: samePatientStudiesCount }) }}
                        <router-link :to='samePatientStudiesLink'>{{ $t('this_patient_has_other_studies_show') }}</router-link>
                    </div>
                    <div v-if="isRemoteSource && remoteStudyFoundLocally" class="patient-studies-info">
                        <i class="bi bi-check-circle me-1"></i>
                        {{ $t('this_study_is_already_stored_locally') }}
                        <router-link :to='sameLocalStudyLink'>{{ $t('this_study_is_already_stored_locally_show') }}</router-link>
                    </div>
                </div>
            </div>
            
            <!-- Labels Section -->
            <div v-if="showLabels && uiOptions.EnableEditLabels" class="labels-section">
                <LabelsEditor :labels="labels" :title="'labels.study_details_title'" :key="labelsComponentKey" :studyId="studyId" ></LabelsEditor>
            </div>
            <div v-if="showLabels && !uiOptions.EnableEditLabels && labels && labels.length > 0" class="labels-section">
                <h6><i class="bi bi-tags me-2"></i>{{ $t('labels.study_details_title') }}</h6>
                <div class="labels-list">
                    <span v-for="label in labels" :key="label" class="study-label">
                        <i class="fa fa-tag"></i>{{ label }}
                    </span>
                </div>
            </div>
            
            <!-- Actions Section -->
            <div class="actions-section">
                <span class="actions-label">Actions:</span>
                <div class="action-buttons">
                    <ResourceButtonGroup :resourceOrthancId="this.studyId" :resourceLevel="'study'"
                        :patientMainDicomTags="this.patientMainDicomTags" :studyMainDicomTags="this.studyMainDicomTagsLocalCopy"
                        :resourceDicomUid="this.studyMainDicomTagsLocalCopy.StudyInstanceUID" :studySeries="this.studySeries" @deletedResource="onDeletedStudy">
                    </ResourceButtonGroup>
                </div>
            </div>
            
            <!-- Audit Logs Link -->
            <div v-if="uiOptions.EnableAuditLogs" class="audit-logs-link">
                <router-link class="router-link" :to="'/audit-logs?resource-id=' + this.studyId">
                    <i class="bi bi-journal-text me-1"></i>{{ $t('audit_logs.expand_logs') }}
                </router-link>
            </div>
        </div>
        
        <!-- Series List -->
        <div class="series-section">
            <SeriesList :studyId="this.studyId" :studyMainDicomTags="this.studyMainDicomTagsLocalCopy"
                :patientMainDicomTags="this.patientMainDicomTags" :studySeries="this.studySeries" @deletedStudy="onDeletedStudy"></SeriesList>
        </div>
    </div>
</template>

<style scoped>
/* ===========================================
   DETAILS CONTAINER
   =========================================== */
.study-details-container {
    background: #f8fafc;
    border-top: 1px solid #e5e7eb;
}

.details-content {
    padding: 24px;
    background: #ffffff;
    margin: 16px;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    border: 1px solid #e5e7eb;
}

/* ===========================================
   INFO GRID
   =========================================== */
.details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin-bottom: 24px;
}

.info-section {
    background: #f9fafb;
    padding: 20px;
    border-radius: 10px;
    border: 1px solid #f3f4f6;
}

.info-section h6 {
    margin-bottom: 16px;
    color: #374151;
    font-weight: 600;
    font-size: 13px;
    display: flex;
    align-items: center;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.info-section h6 i {
    color: #4a90e2;
}

.info-row {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    font-size: 13px;
    min-height: 28px;
    padding: 4px 0;
}

.info-label {
    font-weight: 500;
    color: #6b7280;
    min-width: 160px;
    flex-shrink: 0;
}

.info-value {
    color: #1f2937;
    font-weight: 500;
    word-break: break-word;
    flex: 1;
}

.info-value.uid-text {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 11px;
    word-break: break-all;
    color: #6b7280;
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
}

/* ===========================================
   COPY BUTTON
   =========================================== */
.copy-btn {
    background: none;
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    color: #9ca3af;
    opacity: 0.6;
    transition: all 0.15s ease;
    border-radius: 4px;
    margin-left: 8px;
    flex-shrink: 0;
}

.copy-btn:hover {
    opacity: 1;
    background: #e8f4fd;
    color: #4a90e2;
}

.copy-btn .bi-check {
    color: #10b981;
}

/* ===========================================
   PATIENT STUDIES INFO
   =========================================== */
.patient-studies-info {
    margin-top: 14px;
    padding: 10px 14px;
    background: #e8f4fd;
    border: 1px solid #93c5fd;
    border-radius: 8px;
    font-size: 12px;
    color: #2563eb;
}

.patient-studies-info i {
    color: #4a90e2;
}

.patient-studies-info a {
    color: #357abd;
    text-decoration: none;
    font-weight: 500;
}

.patient-studies-info a:hover {
    text-decoration: underline;
}

/* ===========================================
   LABELS SECTION
   =========================================== */
.labels-section {
    margin-bottom: 24px;
    padding: 16px 20px;
    background: #f9fafb;
    border-radius: 10px;
    border: 1px solid #f3f4f6;
}

.labels-section h6 {
    margin-bottom: 12px;
    color: #374151;
    font-weight: 600;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.labels-section h6 i {
    color: #4a90e2;
}

.labels-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.study-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    background: #e8f4fd;
    border: 1px solid #93c5fd;
    border-radius: 6px;
    font-size: 12px;
    color: #2563eb;
    font-weight: 500;
    transition: all 0.15s ease;
}

.study-label:hover {
    background: #d1e9fa;
}

.study-label i {
    font-size: 10px;
    opacity: 0.7;
}

/* ===========================================
   ACTIONS SECTION
   =========================================== */
.actions-section {
    display: flex;
    align-items: center;
    padding: 16px 0;
    border-top: 1px solid #e5e7eb;
    margin-top: 8px;
}

.actions-label {
    font-weight: 600;
    margin-right: 20px;
    color: #374151;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.action-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

/* ===========================================
   AUDIT LOGS
   =========================================== */
.audit-logs-link {
    padding-top: 12px;
}

.audit-logs-link a {
    color: #4a90e2;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #e8f4fd;
    border-radius: 6px;
    transition: all 0.15s ease;
}

.audit-logs-link a:hover {
    background: #d1e9fa;
    text-decoration: none;
}

/* ===========================================
   SERIES SECTION
   =========================================== */
.series-section {
    padding: 0 16px 16px 16px;
}

/* ===========================================
   RESPONSIVE
   =========================================== */
@media (max-width: 768px) {
    .details-grid {
        grid-template-columns: 1fr;
        gap: 16px;
    }
    
    .details-content {
        margin: 12px;
        padding: 16px;
    }
}
</style>

<style>
/* Global styles for ResourceButtonGroup inside StudyDetails */
.study-details-container .study-button-group i {
    font-size: 1rem;
}

.study-details-container .study-button-group .btn {
    padding: 8px 14px;
    font-size: 13px;
    border-radius: 6px;
    font-weight: 500;
    transition: all 0.15s ease;
}

.study-details-container .study-button-group .btn-group .btn {
    padding: 8px 14px;
    font-size: 13px;
    border-radius: 0;
}

.study-details-container .study-button-group .btn-group .btn:first-child {
    border-radius: 6px 0 0 6px;
}

.study-details-container .study-button-group .btn-group .btn:last-child {
    border-radius: 0 6px 6px 0;
}

.study-details-container .study-button-group .btn-primary {
    background: #4a90e2;
    border-color: #4a90e2;
}

.study-details-container .study-button-group .btn-primary:hover {
    background: #357abd;
    border-color: #357abd;
}

.study-details-container .study-button-group .btn-outline-secondary {
    border-color: #e5e7eb;
    color: #374151;
}

.study-details-container .study-button-group .btn-outline-secondary:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
}
</style>
