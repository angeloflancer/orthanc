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
.study-details-container {
    background-color: var(--study-details-bg-color);
}

.details-content {
    padding: 20px;
}

.details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    margin-bottom: 20px;
}

.info-section h6 {
    margin-bottom: 15px;
    color: var(--bs-body-color);
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
}

.info-row {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    font-size: 13px;
    min-height: 28px;
}

.info-label {
    font-weight: 500;
    color: var(--bs-secondary-color);
    min-width: 160px;
    flex-shrink: 0;
}

.info-value {
    color: var(--bs-body-color);
    font-weight: 400;
    word-break: break-word;
    flex: 1;
}

.info-value.uid-text {
    font-family: monospace;
    font-size: 11px;
    word-break: break-all;
}

.copy-btn {
    background: none;
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    color: var(--bs-secondary-color);
    opacity: 0.6;
    transition: all 0.2s;
    border-radius: 4px;
    margin-left: 8px;
    flex-shrink: 0;
}

.copy-btn:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.05);
    color: #4a90e2;
}

.copy-btn .bi-check {
    color: #28a745;
}

.patient-studies-info {
    margin-top: 12px;
    padding: 8px 12px;
    background: rgba(74, 144, 226, 0.1);
    border-radius: 6px;
    font-size: 12px;
    color: var(--bs-body-color);
}

.patient-studies-info a {
    color: #4a90e2;
    text-decoration: none;
}

.patient-studies-info a:hover {
    text-decoration: underline;
}

.labels-section {
    margin-bottom: 20px;
    padding: 15px;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 8px;
}

.labels-section h6 {
    margin-bottom: 10px;
    color: var(--bs-body-color);
    font-weight: 600;
    font-size: 14px;
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
    padding: 3px 10px;
    background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(74, 144, 226, 0.05) 100%);
    border: 1px solid rgba(74, 144, 226, 0.2);
    border-radius: 12px;
    font-size: 11px;
    color: #4a90e2;
    font-weight: 500;
}

.study-label i {
    font-size: 9px;
    opacity: 0.7;
}

.actions-section {
    display: flex;
    align-items: center;
    padding: 15px 0;
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
    flex-wrap: wrap;
}

.audit-logs-link {
    padding-top: 10px;
}

.audit-logs-link a {
    color: #4a90e2;
    text-decoration: none;
    font-size: 13px;
}

.audit-logs-link a:hover {
    text-decoration: underline;
}

.series-section {
    padding: 0 20px 20px 20px;
}

@media (max-width: 768px) {
    .details-grid {
        grid-template-columns: 1fr;
    }
}
</style>

<style>
/* Global styles for ResourceButtonGroup inside StudyDetails */
.study-details-container .study-button-group i {
    font-size: 1rem;
}

.study-details-container .study-button-group .btn {
    padding: 6px 12px;
    font-size: 0.875rem;
}

.study-details-container .study-button-group .btn-group .btn {
    padding: 6px 12px;
    font-size: 0.875rem;
}
</style>
