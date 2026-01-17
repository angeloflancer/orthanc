<script>
import ResourceButtonGroup from "./ResourceButtonGroup.vue";
import InstanceList from "./InstanceList.vue";
import InstanceListExtended from "./InstanceListExtended.vue";
import ResourceDetailText from "./ResourceDetailText.vue";
import { mapState, mapGetters } from "vuex"
import api from "../orthancApi";
import SourceType from '../helpers/source-type';
import dateHelpers from "../helpers/date-helpers";
import { translateDicomTag } from "../locales/i18n";


export default {
    props: ['seriesId', 'seriesMainDicomTags', 'studyMainDicomTags', 'patientMainDicomTags', 'instancesIds'],
    emits: ['deletedSeries'],
    setup() {
    },
    data() {
        return {
            seriesInstances: [],
            copiedField: null
        };
    },
    computed: {
        ...mapState({
            uiOptions: state => state.configuration.uiOptions,
            studiesSourceType: state => state.studies.sourceType,
            studiesRemoteSource: state => state.studies.remoteSource,
            hasExtendedFind: state => state.configuration.hasExtendedFind
        }),
        useExtendedInstanceList() {
            return this.hasExtendedFind && this.studiesSourceType == SourceType.LOCAL_ORTHANC;
        },
        seriesInfoFields() {
            const fields = [];
            if (this.uiOptions && this.uiOptions.SeriesMainTags) {
                for (const tag of this.uiOptions.SeriesMainTags) {
                    let value = this.seriesMainDicomTags[tag] || '';
                    if (dateHelpers.isDateTag(tag) && value) {
                        value = dateHelpers.formatDateForDisplay(value, this.uiOptions.DateFormat);
                    }
                    fields.push({
                        key: tag,
                        label: translateDicomTag(this.$i18n.t, this.$i18n.te, tag),
                        value: value
                    });
                }
            }
            return fields;
        }
    },
    async mounted() {
        if (this.studiesSourceType == SourceType.LOCAL_ORTHANC) {
            if (this.useExtendedInstanceList) {
                this.seriesInstances = await api.getSeriesInstancesExtended(this.seriesId, null);
            } else {
                this.seriesInstances = await api.getSeriesInstances(this.seriesId);
            }
        } else if (this.studiesSourceType == SourceType.REMOTE_DICOM) {
            let remoteInstances = (await api.remoteDicomFind("Instance", this.studiesRemoteSource, {
                    "StudyInstanceUID": this.studyMainDicomTags.StudyInstanceUID,
                    "PatientID": this.patientMainDicomTags.PatientID,
                    "SeriesInstanceUID": this.seriesMainDicomTags.SeriesInstanceUID,
                    "SOPInstanceUID": "",
                    "InstanceNumber": "",
                    "NumberOfFrames": ""
                },
                false /* isUnique */));
            this.seriesInstances = remoteInstances.map(s => { return {
                "ID": s["SOPInstanceUID"],
                "MainDicomTags": s
            }})
            this.seriesInstances = this.seriesInstances.sort((a, b) => (parseInt(a.MainDicomTags.InstanceNumber) ?? a.MainDicomTags.SOPInstanceUID) < (parseInt(b.MainDicomTags.InstanceNumber) ?? b.MainDicomTags.SOPInstanceUID) ? 1 : -1);
        } else if (this.studiesSourceType == SourceType.REMOTE_DICOM_WEB) {
            let remoteInstances = (await api.qidoRs("Instance", this.studiesRemoteSource, {
                    "StudyInstanceUID": this.studyMainDicomTags.StudyInstanceUID,
                    "SeriesInstanceUID": this.seriesMainDicomTags.SeriesInstanceUID,
                    "SOPInstanceUID": "",
                    "InstanceNumber": "",
                    "NumberOfFrames": ""
                },
                false /* isUnique */));
            this.seriesInstances = remoteInstances.map(s => { return {
                "ID": s["SOPInstanceUID"],
                "MainDicomTags": s
            }})
            this.seriesInstances = this.seriesInstances.sort((a, b) => (parseInt(a.MainDicomTags.InstanceNumber) ?? a.MainDicomTags.SOPInstanceUID) < (parseInt(b.MainDicomTags.InstanceNumber) ?? b.MainDicomTags.SOPInstanceUID) ? 1 : -1);
        }
    },
    components: { ResourceButtonGroup, InstanceList, InstanceListExtended, ResourceDetailText },
    methods: {
        onDeletedInstance(instanceId) {
            const pos = this.instancesIds.indexOf(instanceId);
            if (pos >= 0) {
                this.instancesIds.splice(pos, 1);
                if (this.instancesIds.length == 0) {
                    this.$emit("deletedSeries", this.seriesId);
                }
            }
        },
        onDeletedSeries() {
            this.$emit("deletedSeries", this.seriesId);
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
    <div class="series-details-container">
        <!-- Modern Details Grid -->
        <div class="details-content">
            <div class="details-grid">
                <!-- Series Info -->
                <div class="info-section">
                    <h6><i class="bi bi-collection me-2"></i>Series Information</h6>
                    <div class="info-row" v-for="field in seriesInfoFields" :key="field.key">
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
            </div>
            
            <!-- Actions Section -->
            <div class="actions-section">
                <span class="actions-label">Actions:</span>
                <div class="action-buttons">
                    <ResourceButtonGroup
                        :resourceOrthancId="this.seriesId"
                        :resourceLevel="'series'"
                        :resourceDicomUid="this.seriesMainDicomTags.SeriesInstanceUID"
                        :studyMainDicomTags="this.studyMainDicomTags"
                        :seriesMainDicomTags="this.seriesMainDicomTags"
                        :patientMainDicomTags="this.patientMainDicomTags"
                        :seriesInstances="this.seriesInstances"
                        :customClass="'instance-button-group'"
                        @deletedResource="onDeletedSeries"
                    ></ResourceButtonGroup>
                </div>
            </div>
        </div>
        
        <!-- Instances List -->
        <div class="instances-section">
            <InstanceList v-if="!useExtendedInstanceList"
                :seriesId="this.seriesId"
                :seriesMainDicomTags="this.seriesMainDicomTags"
                :patientMainDicomTags="this.patientMainDicomTags"
                :studyMainDicomTags="this.studyMainDicomTags"
                :instancesIds="this.instancesIds"
                :seriesInstances="this.seriesInstances"
                @deletedInstance="onDeletedInstance"
            ></InstanceList>
            <InstanceListExtended v-if="useExtendedInstanceList"
                :seriesId="this.seriesId"
                :seriesMainDicomTags="this.seriesMainDicomTags"
                :patientMainDicomTags="this.patientMainDicomTags"
                :studyMainDicomTags="this.studyMainDicomTags"
                :instancesIds="this.instancesIds"
                :seriesInstances="this.seriesInstances"
                @deletedInstance="onDeletedInstance"
            ></InstanceListExtended>
        </div>
    </div>
</template>

<style scoped>
/* Match StudyDetails styles exactly */
.series-details-container {
    background-color: var(--series-details-bg-color);
    font-family: verdana !important;
    font-size: 13px !important;
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
    font-family: verdana !important;
}

.info-row {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    font-size: 13px !important;
    min-height: 28px;
    font-family: verdana !important;
}

.info-label {
    font-weight: 500;
    color: var(--bs-secondary-color);
    min-width: 160px;
    flex-shrink: 0;
    font-family: verdana !important;
    font-size: 13px !important;
}

.info-value {
    color: var(--bs-body-color);
    font-weight: 400;
    word-break: break-word;
    flex: 1;
    font-family: verdana !important;
    font-size: 13px !important;
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
    font-family: verdana !important;
}

.action-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.instances-section {
    padding: 0 20px 20px 20px;
}

@media (max-width: 768px) {
    .details-grid {
        grid-template-columns: 1fr;
    }
}
</style>
<style>
/* Global styles for ResourceButtonGroup inside SeriesDetails */
.series-details-container .instance-button-group i {
    font-size: 1rem;
}

.series-details-container .instance-button-group .btn {
    padding: 6px 12px;
    font-size: 0.875rem;
}

.series-details-container .instance-button-group .btn-group .btn {
    padding: 6px 12px;
    font-size: 0.875rem;
}
</style>