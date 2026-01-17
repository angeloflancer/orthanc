<script>
import InstanceItem from "./InstanceItem.vue"
import api from "../orthancApi"

export default {
    props: ['seriesId', 'seriesMainDicomTags', 'studyMainDicomTags', 'patientMainDicomTags', 'seriesInstances'],
    emits: ['deletedInstance'],
    data() {
        return {
            loaded: false,
            instancesInfo: {}
        };
    },
    computed: {
        sortedInstancesIds() {
            if (this.loaded) {
                let keys = Object.keys(this.instancesInfo);
                keys.sort((a, b) => (parseInt(this.instancesInfo[a].IndexInSeries) > parseInt(this.instancesInfo[b].IndexInSeries) ? 1 : -1))
                return keys;
            } else {
                return [];
            }
        }
    },
    watch: {
        seriesInstances(newValue, oldValue) {
            for (const instanceInfo of this.seriesInstances) {
                this.instancesInfo[instanceInfo.ID] = instanceInfo;
            }
            this.loaded = true;
        }
    },
    async mounted() {
    },
    methods: {
        onDeletedInstance(instanceId) {
            delete this.instancesInfo[instanceId];
            this.$emit("deletedInstance", instanceId);
        }
    },
    components: { InstanceItem }
}
</script>

<template>
    <table class="table table-responsive table-sm instance-table">
        <thead>
            <tr>
                <th width="2%" scope="col" class="instance-table-header"></th>
                <th width="7%" scope="col" class="instance-table-header cut-text" data-bs-toggle="tooltip"
                    :title="$t('dicom_tags.InstanceNumber')">{{ $t('dicom_tags.InstanceNumber') }}</th>
                <th width="40%" scope="col" class="instance-table-header cut-text" data-bs-toggle="tooltip"
                    title="SOP Instance UID">SOP Instance UID</th>
                <th width="5%" scope="col" class="instance-table-header cut-text text-center" data-bs-toggle="tooltip"
                    :title="$t('dicom_tags.NumberOfFrames')">Frame</th>
            </tr>
        </thead>
        <InstanceItem v-for="instanceId in sortedInstancesIds" :key="instanceId" :instanceId="instanceId"
            :instanceInfo="instancesInfo[instanceId]" :studyMainDicomTags="this.studyMainDicomTags"
            :seriesMainDicomTags="this.seriesMainDicomTags" :patientMainDicomTags="this.patientMainDicomTags"
            @deletedInstance="onDeletedInstance"></InstanceItem>
    </table>
</template>

<style>
/* Match parent study-table styles exactly */
.instance-table {
    font-family: verdana !important;
    font-size: 13px !important;
    border-radius: 14px;
    overflow: visible;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06);
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(229, 231, 235, 0.6);
    position: relative;
    table-layout: fixed;
}

.instance-table> :not(:first-child) {
    border-top: 0px !important;
}

.instance-table>:first-child {
    border-bottom: none !important;
}

.instance-table thead {
    background: rgba(249, 250, 251, 0.85);
}

.instance-table>:nth-child(odd) >* >* {
    background-color: var(--instance-odd-bg-color);
}

.instance-table>:nth-child(even) >* >* {
    background-color: var(--instance-even-bg-color);
}

.instance-table th {
    border: none;
    padding: 14px 16px !important;
    font-weight: 500;
    color: #374151;
    transition: background-color 0.2s ease;
    letter-spacing: -0.01em;
    vertical-align: middle !important;
    font-family: verdana !important;
    font-size: 13px !important;
}

.instance-table td {
    text-align: left;
    padding: 14px 16px !important;
    border: none;
    border-bottom: 1px solid rgba(229, 231, 235, 0.35);
    transition: background-color 0.2s ease;
    font-family: verdana !important;
    font-size: 13px !important;
    vertical-align: middle !important;
}

.instance-table > tbody > tr:hover > * {
    background-color: var(--instance-hover-color);
}

.instance-table > tbody > tr.instance-row-expanded:hover > * {
    background-color: var(--instance-details-bg-color);
}
.instance-table > tbody > tr.instance-details-expanded:hover > * {
    background-color: var(--instance-details-bg-color);
}

.instance-table-header {
    text-align: left;
    padding: 14px 16px !important;
    font-weight: 500;
    color: #374151;
    transition: background-color 0.2s ease;
    letter-spacing: -0.01em;
    vertical-align: middle !important;
    font-family: verdana !important;
    font-size: smaller !important;
    background-color: var(--study-table-header-bg-color) !important;
    border: none;
}

</style>