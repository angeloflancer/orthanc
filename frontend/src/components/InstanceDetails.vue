<script>
import api from "../orthancApi";
import ResourceButtonGroup from "./ResourceButtonGroup.vue";
import TagsTree from "./TagsTree.vue";
import { mapState, mapGetters } from "vuex"
import SourceType from '../helpers/source-type';

export default {
    props: ['instanceId', 'seriesMainDicomTags', 'studyMainDicomTags', 'patientMainDicomTags'],
    emits: ['deletedInstance'],
    data() {
        return {
            tags: {},
            headers: {},
            loaded: false
        }
    },
    computed: {
        ...mapState({
            uiOptions: state => state.configuration.uiOptions,
            studiesSourceType: state => state.studies.sourceType,
        }),
    },
    async mounted() {
        if (this.studiesSourceType == SourceType.LOCAL_ORTHANC) {
            this.tags = (await api.getInstanceTags(this.instanceId));
            this.headers = (await api.getInstanceHeader(this.instanceId));
        } else if (this.studiesSourceType == SourceType.REMOTE_DICOM || this.studiesSourceType == SourceType.REMOTE_DICOM_WEB) {
            this.tags = {
                "0008,0018" : {
                    "Name": "SOPInstanceUID",
                    "Type": "String",
                    "Value": this.instanceId
                }
            }
        }
        this.loaded = true;
    },
    components: { ResourceButtonGroup, TagsTree },
    methods: {
        onDeletedInstance() {
            this.$emit('deletedInstance', this.instanceId)
        }
    }

}
</script>


<template>
    <div v-if="loaded" class="instance-details-container">
        <!-- Modern Details Content -->
        <div class="details-content">
            <!-- Headers Section -->
            <div v-if="headers && Object.keys(headers).length > 0" class="info-section">
                <h6><i class="bi bi-file-earmark-text me-2"></i>Instance Headers</h6>
                <div class="tags-tree-wrapper">
                    <TagsTree :tags="headers"></TagsTree>
                </div>
            </div>
            
            <!-- Tags Section -->
            <div v-if="tags && Object.keys(tags).length > 0" class="info-section">
                <h6><i class="bi bi-tags me-2"></i>Instance Tags</h6>
                <div class="tags-tree-wrapper">
                    <TagsTree :tags="tags"></TagsTree>
                </div>
            </div>
            
            <!-- Actions Section -->
            <div class="actions-section">
                <span class="actions-label">Actions:</span>
                <div class="action-buttons">
                    <ResourceButtonGroup
                        :resourceOrthancId="this.instanceId"
                        :resourceLevel="'instance'"
                        :studyMainDicomTags="this.studyMainDicomTags"
                        :seriesMainDicomTags="this.seriesMainDicomTags"
                        :patientMainDicomTags="this.patientMainDicomTags"
                        :instanceTags="this.tags"
                        :instanceHeaders="this.headers"
                        @deletedResource="onDeletedInstance"
                    ></ResourceButtonGroup>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Match StudyDetails styles exactly */
.instance-details-container {
    background-color: var(--instance-details-bg-color);
    font-family: verdana !important;
    font-size: 13px !important;
}

.details-content {
    padding: 20px;
}

.info-section {
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

.tags-tree-wrapper {
    font-family: verdana !important;
    font-size: 13px !important;
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

</style>
<style>
/* Global styles for ResourceButtonGroup inside InstanceDetails */
.instance-details-container .instance-button-group i {
    font-size: 1rem;
}

.instance-details-container .instance-button-group .btn {
    padding: 6px 12px;
    font-size: 0.875rem;
}

.instance-details-container .instance-button-group .btn-group .btn {
    padding: 6px 12px;
    font-size: 0.875rem;
}

/* Update TagsTree styles to match parent table */
.instance-details-container .details-label {
    font-weight: 500;
    color: var(--bs-secondary-color);
    font-family: verdana !important;
    font-size: 13px !important;
}

.instance-details-container .details {
    color: var(--bs-body-color);
    font-weight: 400;
    font-family: verdana !important;
    font-size: 13px !important;
}
</style>

