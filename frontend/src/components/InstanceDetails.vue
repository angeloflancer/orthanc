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
/* ===========================================
   INSTANCE DETAILS - Modern Heavy Style
   =========================================== */
.instance-details-container {
    background: #f0f9ff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    padding: 16px;
}

.details-content {
    background: #ffffff;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    border: 1px solid #e5e7eb;
}

.info-section {
    margin-bottom: 24px;
    background: #f8fafc;
    padding: 20px;
    border-radius: 10px;
    border: 1px solid #f3f4f6;
}

.info-section h6 {
    margin-bottom: 16px;
    color: #374151;
    font-weight: 600;
    font-size: 12px;
    display: flex;
    align-items: center;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
}

.info-section h6 i {
    color: #4a90e2;
    margin-right: 10px;
}

.tags-tree-wrapper {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    max-height: 400px;
    overflow-y: auto;
    background: #ffffff;
    border-radius: 8px;
    padding: 12px;
    border: 1px solid #e5e7eb;
}

/* Actions Section */
.actions-section {
    display: flex;
    align-items: center;
    padding: 20px 0 0 0;
    border-top: 2px solid #e5e7eb;
    margin-top: 8px;
}

.actions-label {
    font-weight: 600;
    margin-right: 20px;
    color: #374151;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
}

.action-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

/* Responsive */
@media (max-width: 768px) {
    .details-content {
        padding: 16px;
    }
    
    .info-section {
        padding: 16px;
    }
    
    .actions-section {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
    
    .tags-tree-wrapper {
        max-height: 300px;
    }
}
</style>
<style>
/* Global styles for ResourceButtonGroup inside InstanceDetails */
.instance-details-container .instance-button-group i {
    font-size: 15px;
}

.instance-details-container .instance-button-group .btn {
    padding: 8px 14px;
    font-size: 13px;
}

.instance-details-container .instance-button-group .btn-group .btn {
    padding: 8px 14px;
    font-size: 13px;
}

/* Update TagsTree styles to match parent table */
.instance-details-container .details-label {
    font-weight: 500;
    color: #6b7280;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
}

.instance-details-container .details {
    color: #1f2937;
    font-weight: 400;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
}
</style>

