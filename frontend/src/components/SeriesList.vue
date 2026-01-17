<script>
import axios from "axios"
import api from "../orthancApi"
import SeriesItem from "./SeriesItem.vue"
import { translateDicomTag } from "../locales/i18n"

export default {
    props: ['studyId', 'patientMainDicomTags', 'studyMainDicomTags', 'studySeries'],
    emits: ['deletedStudy'],
    data() {
        return {
            seriesInfo: {},
        };
    },
    computed: {
        sortedSeriesIds() {
            let keys = Object.keys(this.seriesInfo);
            keys.sort((a, b) => (parseInt(this.seriesInfo[a].MainDicomTags.SeriesNumber) > parseInt(this.seriesInfo[b].MainDicomTags.SeriesNumber) ? 1 : -1))
            return keys;
        }
    },
    watch: {
        studySeries(newValue, oldValue) {
            for (const series of this.studySeries) {
                this.seriesInfo[series["ID"]] = series;
            }
        }
    },
    methods: {
        columnTitle(tagName) {
            if (tagName == "instances_number") {
                return "# " + this.$i18n.t('instances');
            } else {
                return translateDicomTag(this.$i18n.t, this.$i18n.te, tagName);
            }
        },
        columnTooltip(tagName) {
            if (tagName == "instances_number") {
                return this.$i18n.t("instances_number");
            } else {
                return translateDicomTag(this.$i18n.t, this.$i18n.te, tagName);
            }
        },
        onDeletedSeries(seriesId) {
            delete this.seriesInfo[seriesId];
            if (Object.keys(this.seriesInfo).length == 0) {
                this.$emit("deletedStudy", this.studyId);
            } else {
                this.messageBus.emit('deleted-series-from-study-' + this.studyId);
            }
        }
    },
    components: { SeriesItem }
}
</script>

<template>
    <table class="table table-responsive table-sm series-table">
        <thead>
            <tr>
                <th width="2%" scope="col" class="series-table-header"></th>
                <th
                    width="7%"
                    scope="col"
                    class="series-table-header cut-text"
                    data-bs-toggle="tooltip"
                    :title="columnTooltip('SeriesNumber')"
                    >{{columnTitle('SeriesNumber')}}</th>
                <th
                width="40%"
                scope="col"
                class="series-table-header cut-text"
                data-bs-toggle="tooltip"
                :title="columnTooltip('SeriesDescription')"
                >{{columnTitle('SeriesDescription')}}</th>
                <th
                width="11%"
                scope="col"
                class="series-table-header cut-text text-center"
                data-bs-toggle="tooltip"
                :title="columnTooltip('Modality')"
                >{{columnTitle('Modality')}}</th>
                <th
                width="5%"
                scope="col"
                class="series-table-header cut-text text-center"
                data-bs-toggle="tooltip"
                :title="columnTooltip('instances_number')"
                >{{columnTitle('instances_number')}}</th>
            </tr>
        </thead>
        <SeriesItem
            v-for="seriesId in sortedSeriesIds"
            :key="seriesId"
            :seriesId="seriesId"
            :seriesInfo="seriesInfo[seriesId]"
            :studyMainDicomTags="this.studyMainDicomTags"
            :patientMainDicomTags="this.patientMainDicomTags"
            @deletedSeries="onDeletedSeries"
        ></SeriesItem>
    </table>
</template>

<style>
/* Match parent study-table styles exactly */
.series-table {
    font-family: verdana !important;
    font-size: 13px !important;
    border-radius: 14px;
    overflow: visible;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06);
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(229, 231, 235, 0.6);
    position: relative;
}

.series-table>:not(:first-child) {
    border-top: 0px !important;
}

.series-table>:first-child {
    border-bottom: none !important;
}

.series-table thead {
    background: rgba(249, 250, 251, 0.85);
}

.series-table>:nth-child(odd) >* >* {
    background-color: var(--series-odd-bg-color);
}

.series-table>:nth-child(even) >* >* {
    background-color: var(--series-even-bg-color);
}

.series-table > tbody > tr:hover > *{
    background-color: var(--series-hover-color);
}

.series-table > tbody > tr.series-row-expanded:hover > * {
    background-color: var(--series-details-bg-color);
}
.series-table > tbody > tr.series-details-expanded:hover > * {
    background-color: var(--series-details-bg-color);
}

.series-table-header {
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

.series-table th {
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

.series-table td {
    text-align: left;
    padding: 14px 16px !important;
    border: none;
    border-bottom: 1px solid rgba(229, 231, 235, 0.35);
    transition: background-color 0.2s ease;
    font-family: verdana !important;
    font-size: 13px !important;
    vertical-align: middle !important;
}

</style>