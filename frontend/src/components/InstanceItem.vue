<script>
import InstanceDetails from "./InstanceDetails.vue";
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js"


export default {
    props: ["instanceId", "instanceInfo", 'seriesMainDicomTags', 'studyMainDicomTags', 'patientMainDicomTags'],
    emits: ['deletedInstance'],
    data() {
        return {
            loaded: false,
            expanded: false,
            collapseElement: null
        };
    },
    mounted() {

        this.$refs['instance-collapsible-details'].addEventListener('show.bs.collapse', (e) => {
            if (e.target == e.currentTarget) {
                this.expanded = true;
            }
        });
        this.$refs['instance-collapsible-details'].addEventListener('hide.bs.collapse', (e) => {
            if (e.target == e.currentTarget) {
                this.expanded = false;
            }
        });

        var el = this.$refs['instance-collapsible-details'];
        this.collapseElement = new bootstrap.Collapse(el, {toggle: false});

        for (const [k, v] of Object.entries(this.$route.query)) {
            if (k === 'expand') {
                if (v === 'instance') {
                    this.collapseElement.show();
                }
            }
        }
    },
    methods: {
        onDeletedInstance(instanceId) {
            this.$emit('deletedInstance', instanceId);
        }
    },
    components: { InstanceDetails }
}
</script>


<template>
    <tbody>
        <tr :class="{ 'instance-row-collapsed': !expanded, 'instance-row-expanded': expanded }">
            <td style="width: 30px; min-width: 30px; max-width: 30px;"></td>
            <td
                style="width: 100px; min-width: 100px;"
                class="cut-text text-center"
                data-bs-toggle="collapse"
                v-bind:data-bs-target="'#instance-details-' + this.instanceId"
            >{{ instanceInfo.MainDicomTags.InstanceNumber }}</td>
            <td
                class="cut-text"
                data-bs-toggle="collapse"
                v-bind:data-bs-target="'#instance-details-' + this.instanceId"
            >{{ instanceInfo.MainDicomTags.SOPInstanceUID }}</td>
            <td
                style="width: 80px; min-width: 80px;"
                class="cut-text text-center"
                data-bs-toggle="collapse"
                v-bind:data-bs-target="'#instance-details-' + this.instanceId"
            >{{ instanceInfo.MainDicomTags.NumberOfFrames }}</td>
        </tr>
        <tr
            class="collapse"
            :class="{ 'instance-details-collapsed': !expanded, 'instance-details-expanded': expanded }"
            v-bind:id="'instance-details-' + this.instanceId"
            ref="instance-collapsible-details"
        >
            <td colspan="100">
                <InstanceDetails
                    v-if="this.expanded"
                    :instanceId="this.instanceId"
                    :studyMainDicomTags="this.studyMainDicomTags"
                    :seriesMainDicomTags="this.seriesMainDicomTags"
                    :patientMainDicomTags="this.patientMainDicomTags"
                    @deletedInstance="onDeletedInstance"
                ></InstanceDetails>
            </td>
        </tr>
    </tbody>
</template>

<style scoped>
/* ===========================================
   INSTANCE ROW - Modern Heavy Style
   =========================================== */
.instance-row-collapsed {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    cursor: pointer;
    transition: all 0.15s ease;
}

.instance-row-collapsed td {
    padding: 14px 18px !important;
    color: #374151;
}

.instance-row-expanded {
    background: #e8f4fd !important;
    font-weight: 500 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    border-top: none !important;
    border-left: 3px solid #4a90e2;
}

.instance-row-expanded > td {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    padding: 14px 18px !important;
    background: #e8f4fd !important;
    color: #1e40af;
}

.instance-row-expanded > :first-child {
    border-bottom: 0px !important;
}

/* Instance Details Expanded Row */
.instance-details-expanded {
    background: #f0f9ff !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    border-top: none !important;
    border-bottom: 2px solid #e5e7eb !important;
}

.instance-details-expanded > td {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    padding: 0 !important;
    background: #f0f9ff !important;
}

/* Ensure all instance table cells match */
.instance-row-collapsed td,
.instance-row-expanded td {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    padding: 14px 18px !important;
    vertical-align: middle !important;
    transition: background-color 0.15s ease;
}

/* Cut text */
.cut-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>