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
                <th style="width: 30px; min-width: 30px; max-width: 30px;" scope="col" class="instance-table-header"></th>
                <th style="width: 100px; min-width: 100px;" scope="col" class="instance-table-header cut-text text-center" data-bs-toggle="tooltip"
                    :title="$t('dicom_tags.InstanceNumber')">{{ $t('dicom_tags.InstanceNumber') }}</th>
                <th scope="col" class="instance-table-header cut-text" data-bs-toggle="tooltip"
                    title="SOP Instance UID">SOP Instance UID</th>
                <th style="width: 80px; min-width: 80px;" scope="col" class="instance-table-header cut-text text-center" data-bs-toggle="tooltip"
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
/* ===========================================
   INSTANCE TABLE - Modern Heavy Style
   =========================================== */
.instance-table {
    width: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
    background: #ffffff;
    border: 1px solid #e5e7eb;
    margin-top: 16px;
    table-layout: auto;
}

.instance-table > :not(:first-child) {
    border-top: 0px !important;
}

.instance-table > :first-child {
    border-bottom: none !important;
}

/* Instance Table Header */
.instance-table thead {
    background: #f8fafc;
}

.instance-table thead tr {
    border-bottom: 2px solid #e5e7eb;
}

.instance-table-header {
    text-align: left;
    padding: 14px 18px !important;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    font-size: 11px !important;
    letter-spacing: 0.5px;
    vertical-align: middle !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    background: #f8fafc !important;
    border: none;
}

.instance-table th {
    border: none;
    padding: 14px 18px !important;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    font-size: 11px !important;
    letter-spacing: 0.5px;
    vertical-align: middle !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    background: #f8fafc !important;
}

/* Instance Table Body */
.instance-table td {
    text-align: left;
    padding: 14px 18px !important;
    border: none;
    border-bottom: 1px solid #f3f4f6;
    transition: background-color 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    vertical-align: middle !important;
    color: #374151;
}

/* Alternating Row Colors */
.instance-table tbody tr:nth-child(odd) td {
    background-color: #ffffff;
}

.instance-table tbody tr:nth-child(even) td {
    background-color: #fafbfc;
}

/* Hover Effects - Simple solid color, no gradient */
.instance-table > tbody > tr:hover > * {
    background-color: #e8f4fd !important;
}

.instance-table > tbody > tr.instance-row-expanded:hover > * {
    background-color: #dbeef9 !important;
}

.instance-table > tbody > tr.instance-details-expanded:hover > * {
    background-color: #f0f9ff !important;
}

/* Cut text utility */
.instance-table .cut-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 300px;
}

/* Responsive */
@media (max-width: 768px) {
    .instance-table {
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
    
    .instance-table td,
    .instance-table th {
        padding: 12px 14px !important;
        font-size: 12px !important;
    }
}
</style>