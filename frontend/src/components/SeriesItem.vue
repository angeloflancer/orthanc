<script>
import SeriesDetails from "./SeriesDetails.vue";
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js"
import { mapState, mapGetters } from "vuex"
import SourceType from '../helpers/source-type';


export default {
    props: ["seriesId", "seriesInfo", 'studyMainDicomTags', 'patientMainDicomTags'],
    emits: ['deletedSeries'],
    data() {
        return {
            loaded: false,
            expanded: false,
            collapseElement: null
        };
    },
    computed: {
        ...mapState({
            studiesSourceType: state => state.studies.sourceType,
        }),
        instancesCount() {
            if (this.studiesSourceType == SourceType.LOCAL_ORTHANC) {
                return this.seriesInfo.Instances.length;
            } else if (this.studiesSourceType == SourceType.REMOTE_DICOM || this.studiesSourceType == SourceType.REMOTE_DICOM_WEB) {
                return this.seriesInfo.MainDicomTags.NumberOfSeriesRelatedInstances;
            }
        }
    },
    mounted() {
        this.$refs['series-collapsible-details'].addEventListener('show.bs.collapse', (e) => {
            if (e.target == e.currentTarget) {
                this.expanded = true;
            }
        });
        this.$refs['series-collapsible-details'].addEventListener('hide.bs.collapse', (e) => {
            if (e.target == e.currentTarget) {
                this.expanded = false;
            }
        });

        var el = this.$refs['series-collapsible-details'];
        this.collapseElement = new bootstrap.Collapse(el, {toggle: false});

        for (const [k, v] of Object.entries(this.$route.query)) {
            if (k === 'expand') {
                if (v === 'series' || v === 'instance') {
                    this.collapseElement.show();
                }
            }
        }
    },
    methods: {
        onDeletedSeries() {
            this.$emit("deletedSeries", this.seriesId);
        }
    },
    components: { SeriesDetails }
}
</script>


<template>
    <tbody>
        <tr :class="{ 'series-row-collapsed': !expanded, 'series-row-expanded': expanded }">
            <td style="width: 30px; min-width: 30px; max-width: 30px;"></td>
            <td
                style="width: 80px; min-width: 80px;"
                class="cut-text text-center"
                data-bs-toggle="collapse"
                v-bind:data-bs-target="'#series-details-' + this.seriesId"
            >{{ seriesInfo.MainDicomTags.SeriesNumber }}</td>
            <td
                class="cut-text"
                data-bs-toggle="collapse"
                v-bind:data-bs-target="'#series-details-' + this.seriesId"
            >
                <span
                    data-bs-toggle="tooltip"
                    v-bind:title="seriesInfo.MainDicomTags.SeriesDescription"
                >{{ seriesInfo.MainDicomTags.SeriesDescription }}</span>
            </td>
            <td
                style="width: 100px; min-width: 100px;"
                class="cut-text text-center"
                data-bs-toggle="collapse"
                v-bind:data-bs-target="'#series-details-' + this.seriesId"
            >{{ seriesInfo.MainDicomTags.Modality }}</td>
            <td
                style="width: 80px; min-width: 80px;"
                class="cut-text text-center"
                data-bs-toggle="collapse"
                v-bind:data-bs-target="'#series-details-' + this.seriesId"
            >{{ instancesCount }}</td>
        </tr>
        <tr
            class="collapse"
            :class="{ 'series-details-collapsed': !expanded, 'series-details-expanded': expanded }"
            v-bind:id="'series-details-' + this.seriesId"
            ref="series-collapsible-details"
        >
            <td colspan="100">
                <SeriesDetails
                    v-if="this.expanded"
                    :seriesId="this.seriesId"
                    :instancesIds="this.seriesInfo.Instances"
                    :seriesMainDicomTags="this.seriesInfo.MainDicomTags"
                    :studyMainDicomTags="this.studyMainDicomTags"
                    :patientMainDicomTags="this.patientMainDicomTags"
                    @deletedSeries="onDeletedSeries"
                ></SeriesDetails>
            </td>
        </tr>
    </tbody>
</template>

<style scoped>
/* ===========================================
   SERIES ROW - Modern Heavy Style
   =========================================== */
.series-row-collapsed {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    cursor: pointer;
    transition: all 0.15s ease;
}

.series-row-collapsed td {
    padding: 14px 18px !important;
    color: #374151;
}

.series-row-expanded {
    background: #e8f4fd !important;
    font-weight: 500 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    border-top: none !important;
    border-left: 3px solid #4a90e2;
}

.series-row-expanded > td {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    padding: 14px 18px !important;
    background: #e8f4fd !important;
    color: #1e40af;
}

.series-row-expanded > :first-child {
    border-bottom: 0px !important;
}

/* Series Details Expanded Row */
.series-details-expanded {
    background: #f0f9ff !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    border-top: none !important;
    border-bottom: 2px solid #e5e7eb !important;
}

.series-details-expanded > td {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Verdana, sans-serif !important;
    font-size: 13px !important;
    padding: 0 !important;
    background: #f0f9ff !important;
}

/* Ensure all series table cells match */
.series-row-collapsed td,
.series-row-expanded td {
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