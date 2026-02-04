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
                <th style="width: 30px; min-width: 30px; max-width: 30px;" scope="col" class="series-table-header"></th>
                <th
                    style="width: 80px; min-width: 80px;"
                    scope="col"
                    class="series-table-header cut-text text-center"
                    data-bs-toggle="tooltip"
                    :title="columnTooltip('SeriesNumber')"
                    >{{columnTitle('SeriesNumber')}}</th>
                <th
                scope="col"
                class="series-table-header cut-text"
                data-bs-toggle="tooltip"
                :title="columnTooltip('SeriesDescription')"
                >{{columnTitle('SeriesDescription')}}</th>
                <th
                style="width: 100px; min-width: 100px;"
                scope="col"
                class="series-table-header cut-text text-center"
                data-bs-toggle="tooltip"
                :title="columnTooltip('Modality')"
                >{{columnTitle('Modality')}}</th>
                <th
                style="width: 80px; min-width: 80px;"
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
/* ===========================================
   SERIES TABLE - Modern Heavy Style
   =========================================== */
.series-table {
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

.series-table > :not(:first-child) {
    border-top: 0px !important;
}

.series-table > :first-child {
    border-bottom: none !important;
}

/* Series Table Header */
.series-table thead {
    background: #f8fafc;
}

.series-table thead tr {
    border-bottom: 2px solid #e5e7eb;
}

.series-table-header {
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

.series-table th {
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

/* Series Table Body */
.series-table td {
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
.series-table tbody tr:nth-child(odd) td {
    background-color: #ffffff;
}

.series-table tbody tr:nth-child(even) td {
    background-color: #fafbfc;
}

/* Hover Effects - Simple solid color, no gradient */
.series-table > tbody > tr:hover > * {
    background-color: #e8f4fd !important;
}

.series-table > tbody > tr.series-row-expanded:hover > * {
    background-color: #dbeef9 !important;
}

.series-table > tbody > tr.series-details-expanded:hover > * {
    background-color: #f0f9ff !important;
}

/* Cut text utility */
.series-table .cut-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
}

/* Responsive */
@media (max-width: 768px) {
    .series-table {
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
    
    .series-table td,
    .series-table th {
        padding: 12px 14px !important;
        font-size: 12px !important;
    }
}
</style>