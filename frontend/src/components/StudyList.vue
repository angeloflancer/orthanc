<script>
import ResourceButtonGroup from "./ResourceButtonGroup.vue"
import LabelsEditor from "./LabelsEditor.vue"
import Toasts from "./Toasts.vue"
import CopyToClipboardButton from "./CopyToClipboardButton.vue"
import resourceHelpers from "../helpers/resource-helpers"

import { mapState, mapGetters } from "vuex"
import { baseOe2Url } from "../globalConfigurations"
import { translateDicomTag } from "../locales/i18n"
import dateHelpers from "../helpers/date-helpers"
import $ from "jquery"
import { endOfMonth, endOfYear, startOfMonth, startOfYear, subMonths, subDays, startOfWeek, endOfWeek, subYears } from 'date-fns';
import api from "../orthancApi";
import { ref } from 'vue';
import SourceType from "../helpers/source-type";
import { nextTick } from 'vue';

const Status = Object.freeze({
    UNDEFINED: 0,
    LOADING_MOST_RECENT_STUDIES: 1,
    DISPLAYING_MOST_RECENT_STUDIES: 2,
    DISPLAYING_FILTERED_STUDIES: 3,
});


document._allowedFilters = ["StudyDate", "StudyTime", "AccessionNumber", "PatientID", "PatientName", "PatientBirthDate", "StudyInstanceUID", "StudyID", "StudyDescription", "ModalitiesInStudy", "labels"]

document._studyColumns = {
    "StudyDate": {
        "width": "7%",
        "isOrderable": true
    },
    "AccessionNumber": {
        "width": "11%",
        "placeholder": "1234",
        "isOrderable": true
    },
    "PatientID": {
        "width": "11%",
        "placeholder": "1234",
        "isOrderable": true
    },
    "PatientName": {
        "width": "15%",
        "placeholder": "John^Doe",
        "isOrderable": true
    },
    "PatientBirthDate": {
        "width": "7%",
        "isOrderable": true
    },
    "StudyDescription": {
        "width": "25%",
        "placeholder": "Chest",
        "isOrderable": true
    },
    "Hospital": {
        "width": "8%",
        "placeholder": "Hospital",
        "isOrderable": false
    },
    "UploadedBy": {
        "width": "8%",
        "placeholder": "User",
        "isOrderable": false
    },
    "modalities": {
        "width": "6%",
        "isOrderable": false
    },
    "seriesCount": {
        "width": "4%",
        "isOrderable": false
    },
    "instancesCount": {
        "width": "4%",
        "isOrderable": false
    },
    "seriesAndInstancesCount": {
        "width": "7%",
        "isOrderable": false
    },
    "undefined": {
        "width": "10%",
        "isOrderable": false
    },
    // columns that are not included by default but that are commonly added
    "PatientSex": {
        "width": "7%",
        "placeholder": "",
        "isOrderable": true
    },
    "OtherPatientIDs": {
        "width": "10%",
        "placeholder": "",
        "isOrderable": true
    },
    "InstitutionName": {
        "width": "12%",
        "placeholder": "",
        "isOrderable": true
    },
    "ReferringPhysician": {
        "width": "10%",
        "placeholder": "",
        "isOrderable": true
    },
    "RequestingPhysician": {
        "width": "10%",
        "placeholder": "",
        "isOrderable": true
    },
    "ManufacturerModelName": {
        "width": "10%",
        "placeholder": "",
        "isOrderable": true
    }

};

export default {
    props: [],
    emits: ['deletedStudy'],
    data() {
        return {
            filterStudyDate: '',
            filterStudyDateForDatePicker: '',
            filterPatientBirthDate: '',
            filterPatientBirthDateForDatePicker: '',
            filterModalities: {},
            filterGenericTags : {},
            oldFilterGenericTags : {},
            filterLabels: [],
            filterHospital: '',
            filterUploadedBy: '',
            currentOrderByTag: null,
            currentOrderDirection: 'ASC',
            filterOrderBy: [{'Type': 'Metadata', 'Key': 'LastUpdate', 'Direction': 'DESC'}],
            allModalities: true,
            noneModalities: false,
            updatingFilterUi: false,
            updatingRouteWithoutReload: false,
            initializingModalityFilter: false,
            searchTimerHandler: {},
            columns: document._studyColumns,
            datePickerPresetRanges: document._datePickerPresetRanges,
            allSelected: false,
            isPartialSelected: false,
            mostRecentStudiesIds: [],
            shouldStopLoadingMostRecentStudies: false,
            status: Status.UNDEFINED,
            sourceType: SourceType.LOCAL_ORTHANC,
            remoteSource: null,
            showMultiLabelsFilter: false,
            multiLabelsFilterLabelsConstraint: "All",
            multiLabelsComponentKey: 0, // to force refresh the multi-labels filter component
            // Modern layout: pagination and row menu
            pageSize: 5,
            currentPage: 1,
            openRowMenuId: null,
            expandedStudyId: null, // row expand on click
        };
    },
    computed: {
        ...mapState({
            uiOptions: state => state.configuration.uiOptions,
            allLabels: state => state.labels.allLabels,
            isConfigurationLoaded: state => state.configuration.loaded,
            storeStudiesIds: state => state.studies.studiesIds,
            selectedStudiesIds: state => state.studies.selectedStudiesIds,
            isSearching: state => state.studies.isSearching,
            statistics: state => state.studies.statistics,
            hasExtendedFind: state => state.configuration.hasExtendedFind,
            hasExtendedChanges: state => state.configuration.hasExtendedChanges,
            storeStudies: state => state.studies.studies
        }),
        ...mapGetters([
            'studies/isFilterEmpty',                // -> this['studies/isFilterEmpty']
            'studies/isMostRecentOrdering',         // -> this['studies/isMostRecentOrdering']
        ]),
        notShowingAllResults() {
            if (this.sourceType == SourceType.LOCAL_ORTHANC && !this.hasExtendedFind) {
                if (this.studiesIds.length >= this.statistics.CountStudies) {
                    return false;
                }
                return this.studiesIds.length == this.uiOptions.MaxStudiesDisplayed; // in this case, the result has been limited
            } else {
                return false;
            }
        },
        isDisplayingMostRecentStudies() {
            return this.status == Status.DISPLAYING_MOST_RECENT_STUDIES;
        },
        isLoadingMostRecentStudies() {
            return this.status == Status.LOADING_MOST_RECENT_STUDIES;
        },
        isDarkMode() {
            // hack to switch the theme: get the value from our custom css
            let bootstrapTheme = document.documentElement.getAttribute("data-bs-theme"); // for production
            bootstrapTheme = getComputedStyle(document.documentElement).getPropertyValue('--bootstrap-theme');  // for dev
            // console.log("DatePicker color mode is ", bootstrapTheme);
            return bootstrapTheme == "dark";
        },
        isRemoteDicom() {
            return this.sourceType == SourceType.REMOTE_DICOM;
        },
        isRemoteDicomWeb() {
            return this.sourceType == SourceType.REMOTE_DICOM_WEB;
        },
        isMultiLabelsFilterVisible() {
            return this.sourceType == SourceType.LOCAL_ORTHANC && this.showMultiLabelsFilter && this.uiOptions.EnableMultiLabelsSearch;  
        },
        isSearchAsYouTypeEnabled() {
            if (this.sourceType == SourceType.LOCAL_ORTHANC) {
                return this.uiOptions.StudyListSearchMode == "search-as-you-type";
            } else {
                return false;
            }
        },
        isSearchButtonEnabled() {
            if (this.sourceType == SourceType.LOCAL_ORTHANC) {
                return this.uiOptions.StudyListSearchMode == "search-button";
            } else {
                return true;
            }
        },
        showEmptyStudyListIfNoSearch() {
            if (this.sourceType == SourceType.LOCAL_ORTHANC) {
                return this.uiOptions.StudyListContentIfNoSearch == "empty";
            } else {
                return true;
            }
        },
        studiesIds() {
            // Get studies from store and filter by Hospital/UploadedBy if needed
            if (!this.filterHospital.trim() && !this.filterUploadedBy.trim()) {
                return this.storeStudiesIds || [];
            }
            
            // Filter by Hospital and UploadedBy
            const studies = this.storeStudies || [];
            return studies
                .filter(study => {
                    if (this.filterHospital.trim()) {
                        const hospitalName = study._hospitalName || '';
                        if (!hospitalName.toLowerCase().includes(this.filterHospital.toLowerCase().trim())) {
                            return false;
                        }
                    }
                    if (this.filterUploadedBy.trim()) {
                        const uploadedBy = study._uploadedBy || '';
                        if (!uploadedBy.toLowerCase().includes(this.filterUploadedBy.toLowerCase().trim())) {
                            return false;
                        }
                    }
                    return true;
                })
                .map(s => s.ID);
        },
        isStudyListEmpty() {
            return this.studiesIds.length == 0;
        },
        datePickerFormat() {
            return this.uiOptions.DateFormat;
        },
        hasPrimaryViewerIcon() {
            return this.sourceType == SourceType.LOCAL_ORTHANC && this.uiOptions.EnableViewerQuickButton;
        },
        hasPdfReportIcon() {
            return this.sourceType == SourceType.LOCAL_ORTHANC && this.uiOptions.EnableReportQuickButton;
        },
        selectedStudiesCount() {
            if (this.selectedStudiesIds.length > 0) {
                return this.selectedStudiesIds.length;
            } else {
                return "";
            }
        },
        totalPages() {
            const n = this.studiesIds.length;
            return n === 0 ? 1 : Math.ceil(n / this.pageSize);
        },
        paginatedStudyIds() {
            const start = (this.currentPage - 1) * this.pageSize;
            return this.studiesIds.slice(start, start + this.pageSize);
        },
        paginatedStudies() {
            return this.paginatedStudyIds
                .map(id => this.getStudy(id))
                .filter(Boolean);
        },
        paginationStart() {
            if (this.studiesIds.length === 0) return 0;
            return (this.currentPage - 1) * this.pageSize + 1;
        },
        paginationEnd() {
            return Math.min(this.currentPage * this.pageSize, this.studiesIds.length);
        },
        paginationPageNumbers() {
            const total = this.totalPages;
            if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
            const p = this.currentPage;
            const pages = [];
            pages.push(1);
            if (p > 3) pages.push('...');
            for (let i = Math.max(2, p - 1); i <= Math.min(total - 1, p + 1); i++) {
                if (!pages.includes(i)) pages.push(i);
            }
            if (p < total - 2) pages.push('...');
            if (total > 1) pages.push(total);
            return pages;
        },
        colSpanBeforeMultiLabelsFilter() {
            let span = 1; // the select study col

            if (this.hasPrimaryViewerIcon) {
                span++;
            } 
            if (this.hasPdfReportIcon) {
                span++;
            }
            return span;
        },
        colSpanMultiLabelsFilter() {
            if (this.uiOptions && this.uiOptions.StudyListColumns) {
                let totalColumnsCount = this.uiOptions.StudyListColumns.length+1; // +1 for selection box
                if (this.hasPrimaryViewerIcon) {
                    totalColumnsCount++;
                }
                if (this.hasPdfReportIcon) {
                    totalColumnsCount++;
                }
                return totalColumnsCount - this.colSpanBeforeMultiLabelsFilter - this.colSpanAfterMultiLabelsFilter;
            } else {
                return 4; // temporary until the uiOptions have been loaded
            }
        },
        colSpanAfterMultiLabelsFilter() {
            return 3;
        },
        widthColum1() {
            if (this.colSpanClearFilter == 1) {
                return "4%";
            } else {
                return "2%";
            }
        },
        colSpanClearFilter() {
            if (this.sourceType != SourceType.LOCAL_ORTHANC) {
                return 1;
            }

            let span = 1;
            if (this.hasPrimaryViewerIcon) {
                span++;
            }
            if (this.hasPdfReportIcon) {
                span++;
            }

            return span;
        }
    },
    watch: {
        '$route': {
            handler: async function (to, from) { // the watch is used when, e.g, clicking on the back button
                if (!this.updatingRouteWithoutReload) {
                    await this.updateFilterFromRoute(this.$route.query);
                }
            },
            immediate: false // Don't run on initial mount, we handle it in mounted()
        },
        isConfigurationLoaded(newValue, oldValue) {
            // this is called when opening the page (with a filter or not)
            // console.log("StudyList: Configuration has been loaded, updating study filter: ", this.$route.params.filters);
            this.initModalityFilter();
            for (const tag of this.uiOptions.StudyListColumns) {
                if (['StudyDate', 'PatientBirthDate', 'modalities', 'seriesCount', 'instancesCount', 'seriesAndInstancesCount', 'Hospital', 'UploadedBy'].indexOf(tag) == -1) {
                    this.filterGenericTags[tag] = '';
                }
            }
            this.updateFilterFromRoute(this.$route.query);
            setTimeout(() => {this.showMultiLabelsFilter = true}, 300);  // this is a Hack to prevent this kind of error https://github.com/vuejs/core/issues/5657
        },
        filterModalities: {
            handler(newValue, oldValue) {
                if (!this.updatingFilterUi && !this.initializingModalityFilter) {
                    if (this.isSearchAsYouTypeEnabled) {
                        //    console.log("StudyList: filterModalities watcher", newValue, oldValue);
                        this.updateFilter('ModalitiesInStudy', this.getModalityFilter(), null);
                    } else {
                        this.getModalityFilter(); // to update all/none status
                    }
                }
            },
            deep: true
        },
        filterGenericTags: {
            handler(newValue, oldValue) {
                // oldValue is the same as newValue for deep watchers
                for (const [k, v] of Object.entries(this.filterGenericTags)) {
                    let oldValue = null;
                    if (k in this.oldFilterGenericTags) {
                        oldValue = this.oldFilterGenericTags[k]
                    }
                    this.updateFilter(k, v, oldValue);
                    this.oldFilterGenericTags[k] = v;
                }
            },
            deep: true
        },
        filterStudyDate(newValue, oldValue) {
            // console.log("watch filterStudyDate", newValue);
            this.updateFilter('StudyDate', newValue, oldValue);
        },
        filterStudyDateForDatePicker(newValue, oldValue) {
            let dicomNewValue = dateHelpers.dicomDateFromDatePicker(newValue);
            if (dicomNewValue == null) {
                dicomNewValue = "";
            }
            // console.log("watch filterStudyDateForDatePicker", newValue, dicomNewValue);
            this.filterStudyDate = dicomNewValue;
        },
        filterPatientBirthDate(newValue, oldValue) {
            this.updateFilter('PatientBirthDate', newValue, oldValue);
        },
        filterPatientBirthDateForDatePicker(newValue, oldValue) {
            let dicomNewValue = dateHelpers.dicomDateFromDatePicker(newValue);
            if (dicomNewValue == null) {
                dicomNewValue = "";
            }
            // console.log("watch filterPatientBirthDateForDatePicker", newValue, dicomNewValue);
            this.filterPatientBirthDate = dicomNewValue;
        },
        async multiLabelsFilterLabelsConstraint(newValue, oldValue) {
            if (this.isSearchAsYouTypeEnabled) {
                await this.$store.dispatch('studies/updateLabelFilterNoReload', { labels: this.filterLabels, constraint: this.multiLabelsFilterLabelsConstraint });
                this.updateUrlNoReload();
                this.reloadStudyList();
            }
        },
        selectedStudiesIds: {
            handler() {
                this.updateSelectAll();
            },
            deep: true
        },
        currentPage() {
            this.updateSelectAll();
        },
        studiesIds() {
            if (this.currentPage > this.totalPages && this.totalPages > 0) {
                this.currentPage = this.totalPages;
            }
        },
        allLabels(newValue, oldValue) {
            this.multiLabelsComponentKey++; // force refresh the multi-labels filter component
        }
    },
    async created() {
        this.messageBus.on('language-changed', this.translateDatePicker);
        this.messageBus.on('filter-label-changed', this.filterLabelChanged); // labels are changed in the sidebar, not in the study list itself
        if (this.isConfigurationLoaded) {
            setTimeout(() => {this.showMultiLabelsFilter = true}, 300);  // this is a Hack to prevent this kind of error https://github.com/vuejs/core/issues/5657
        }
    },
    async mounted() {
        this.updateSelectAll();
        // If configuration is already loaded, ensure we process the route query params
        // This is critical when navigating from other routes (e.g., WordFileList, PatientList) to filtered-studies
        // The isConfigurationLoaded watcher might have already fired before the component was mounted,
        // or the route watcher might not fire on initial mount
        if (this.isConfigurationLoaded) {
            // Use nextTick to ensure route is fully initialized
            await this.$nextTick();
            // Check if we have query params that need to be processed
            if (this.$route.query && Object.keys(this.$route.query).length > 0) {
                // Only update if we're not already updating (avoid duplicate calls)
                if (!this.updatingRouteWithoutReload && !this.updatingFilterUi) {
                    await this.updateFilterFromRoute(this.$route.query);
                }
            }
        }
    },
    methods: {
        updateSelectAll() {
            const ids = this.paginatedStudyIds;
            if (ids.length === 0) {
                this.allSelected = false;
                this.isPartialSelected = false;
            } else if (ids.every(id => this.selectedStudiesIds.includes(id))) {
                this.allSelected = true;
                this.isPartialSelected = false;
            } else {
                this.allSelected = false;
                this.isPartialSelected = this.selectedStudiesIds.length > 0;
            }
        },
        clickSelectAll() {
            const ids = this.paginatedStudyIds;
            const allOnPageSelected = ids.length > 0 && ids.every(id => this.selectedStudiesIds.includes(id));
            if (!allOnPageSelected) {
                ids.forEach(id => this.$store.dispatch('studies/selectStudy', { studyId: id, isSelected: true }));
                this.messageBus.emit('selected-all');
            } else {
                ids.forEach(id => this.$store.dispatch('studies/selectStudy', { studyId: id, isSelected: false }));
                this.messageBus.emit('unselected-all');
            }
        },
        translateDatePicker(languageKey) {
            for (let i in document._datePickerPresetRanges) {
                document._datePickerPresetRanges[i].label = this.$t(document._datePickerPresetRanges[i].tLabel);
            }
        },
        columnTitle(tagName) {
            if (tagName == "seriesCount") {
                return this.$i18n.t('series_count_header');
            } else if (tagName == "instancesCount") {
                return this.$i18n.t('instances_count_header');
            } else if (tagName == "seriesAndInstancesCount") {
                return this.$i18n.t('series_and_instances_count_header');
            } else if (tagName == "modalities") {
                return translateDicomTag(this.$i18n.t, this.$i18n.te, "ModalitiesInStudy");
            } else if (tagName == "Hospital") {
                return "Hospital";
            } else if (tagName == "UploadedBy") {
                return "Uploaded By";
            } else {
                return translateDicomTag(this.$i18n.t, this.$i18n.te, tagName);
            }
        },
        columnTooltip(tagName) {
            return this.columnTitle(tagName);
        },
        columnWidth(tagName) {
            if (tagName in this.columns) {
                return this.columns[tagName].width;
            } else {
                return this.columns["undefined"].width;
            }
        },
        isOrderable(tagName) {
            if (this.sourceType != SourceType.LOCAL_ORTHANC || !this.hasExtendedFind) {
                return false;
            }

            if (tagName in document._studyColumns) { 
                return document._studyColumns[tagName].isOrderable;
            } else {
                return false;
            }
        },
        isOrderTagUp(tagName) {
            return tagName == this.currentOrderByTag && this.currentOrderDirection == 'DESC';
        },
        isOrderTagDown(tagName) {
            return tagName == this.currentOrderByTag && this.currentOrderDirection == 'ASC';
        },
        toggleOrder(ev, tagName) {
            ev.preventDefault();
            ev.stopPropagation();

            if (this.currentOrderByTag == tagName) { // this tag is already used for ordering -> change order direction
                this.currentOrderDirection = (this.currentOrderDirection == 'ASC' ? 'DESC' : 'ASC');
            } else { // this tag is not used for ordering
                this.currentOrderByTag = tagName;
                this.currentOrderDirection = 'ASC';
            }
            let o = {'Type': 'DicomTag', 'Key': this.currentOrderByTag, 'Direction': this.currentOrderDirection};

            // remove all DICOM Tag orders and insert this one as the first one
            this.filterOrderBy = [o].concat(this.filterOrderBy.filter(i => i['Type'] != 'DicomTag'));

            this._updateOrderBy(true);
        },
        clearModalityFilter() {
            // console.log("StudyList: clearModalityFilter", this.updatingFilterUi);
            if (this.uiOptions.StudyListColumns) {
                for (const modality of this.uiOptions.ModalitiesFilter) {
                    this.filterModalities[modality] = true;
                }
            }
        },
        filterLabelChanged(label) {
            // If label is null or empty, clear labels filter
            if (label === null || label === undefined || label === '') {
                this.filterLabels = [];
            } else {
                this.filterLabels = [label];
            }
            this.multiLabelsFilterLabelsConstraint = "All";
            this.multiLabelsComponentKey++; // force refresh the multi-labels filter component
            this.search();
        },
        initModalityFilter() {
            // console.log("StudyList: initModalityFilter", this.updatingFilterUi);
            this.initializingModalityFilter = true;
            this.filterModalities = {};
            for (const modality of this.uiOptions.ModalitiesFilter) {
                this.filterModalities[modality] = true;
            }
            this.initializingModalityFilter = false;
        },
        getModalityFilter() {
            if (this.filterModalities === undefined) {
                return "";
            }

            let modalityFilter = "";
            let allSelected = true;
            let selected = [];

            // console.log("getModalityFilter", this.filterModalities);
            for (const [key, value] of Object.entries(this.filterModalities)) {
                allSelected &= value;
                if (value) {
                    selected.push(key);
                }
            }
            if (allSelected) {
                this.allModalities = true;
                this.noneModalities = false;
                return "";
            } else if (selected.length == 0) {
                this.allModalities = false;
                this.noneModalities = true;
                return "NONE"; // something that will not match !
            } else {
                this.allModalities = false;
                this.noneModalities = false;
                return selected.join('\\');
            }
        },
        updateFilter(dicomTagName, newValue, oldValue) {

            if (this.updatingFilterUi) {
                return;
            }

            if (!this.isSearchAsYouTypeEnabled) { // if we are using a "search-button", don't update filter now
                return;
            }

            if (dicomTagName == "ModalitiesInStudy" && oldValue == null) { // not text: e.g. modalities in study -> update directly
                this._updateFilter(dicomTagName, newValue);
                return;
            }

            if (newValue.length >= this.uiOptions.StudyListSearchAsYouTypeMinChars) {
                // calls updateFilter only after a delay without any key pressed and if there are enough characters entered
                if (this.searchTimerHandler[dicomTagName]) {
                    clearTimeout(this.searchTimerHandler[dicomTagName]);
                }
                this.searchTimerHandler[dicomTagName] = setTimeout(() => { this._updateFilter(dicomTagName, newValue) }, this.uiOptions.StudyListSearchAsYouTypeDelay);
            } else if (oldValue && newValue.length < oldValue.length && oldValue.length >= this.uiOptions.StudyListSearchAsYouTypeMinChars) { // when deleting filter
                this.searchTimerHandler[dicomTagName] = setTimeout(() => { this._updateFilter(dicomTagName, "") }, this.uiOptions.StudyListSearchAsYouTypeDelay);
            }
        },
        clipFilter(dicomTagName, value) {
            if (this.isFilterLongEnough(dicomTagName, value)) {
                return value;
            } else {
                return "";
            }
        },
        getMinimalFilterLength(dicomTagName) {
            if (["AccessionNumber", "PatientName", "PatientID", "StudyDescription"].indexOf(dicomTagName) != -1) {
                if (this.isSearchAsYouTypeEnabled) {
                    return this.uiOptions.StudyListSearchAsYouTypeMinChars;
                }
            } else if (["PatientBirthDate", "StudyDate"].indexOf(dicomTagName) != -1) {
                return 8;
            }
            return 0;
        },
        isFilterLongEnough(dicomTagName, value) {
            return value.length >= this.getMinimalFilterLength(dicomTagName);
        },
        getFilterClass(dicomTagName) {
            const value = this.getFilterValue(dicomTagName)
            if (value != null && value.length > 0 && !this.isFilterLongEnough(dicomTagName, value)) {
                return "is-invalid-filter";
            }
            return "";
        },
        hasFilter(tagName) {
            return ['seriesCount', 'instancesCount', 'seriesAndInstancesCount'].indexOf(tagName) == -1;
        },
        getFilterPlaceholder(tagName) {
            if (tagName in this.columns && this.columns[tagName].placeholder) {
                return this.columns[tagName].placeholder;
            } else {
                return "search-text";
            }
        },
        getFilterValue(dicomTagName) {
            if (!this.isConfigurationLoaded) {
                return null;
            }
            if (dicomTagName == "StudyDate") {
                return this.filterStudyDate;
            } else if (dicomTagName == "PatientBirthDate") {
                return this.filterPatientBirthDate;
            } else if (dicomTagName == "ModalitiesInStudy") {
                console.error("getFilterValue ModalitiesInStudy");
            } else {
                return this.filterGenericTags[dicomTagName];
            }
        },
        _updateFilter(dicomTagName, value) {
            this.searchTimerHandler[dicomTagName] = null;
            this.$store.dispatch('studies/updateFilterNoReload', { dicomTagName: dicomTagName, value: value });
            this.updateUrlNoReload();
            this.reloadStudyList();
        },
        _updateOrderBy(reloadNow) {
            this.$store.dispatch('studies/updateOrderByNoReload', { orderBy: this.filterOrderBy });
            if (reloadNow) {
                this.updateUrlNoReload();
                this.reloadStudyList();
            }
        },
        updateOrderBy(orderString, reloadNow) {
            console.log("updateOrderBy", orderString);
            this.filterOrderBy = [];
            this.currentOrderByTag = null;
            this.currentOrderDirection = 'ASC';

            let orders = orderString.split(';');
            for (let order of orders) {
                let o = order.split(',');
                
                this.filterOrderBy.push({'Type': o[0], 'Key': o[1], 'Direction': o[2]});
                
                if (o[0] == 'DicomTag' && this.currentOrderByTag == null) {
                    this.currentOrderByTag = o[1];
                    this.currentOrderDirection = o[2];
                }
            }
            this._updateOrderBy(reloadNow);
        },
        async updateFilterFromRoute(filters) {
            // console.log("StudyList: updateFilterFromRoute", this.updatingFilterUi, filters);

            this.updatingFilterUi = true;
            await this.$store.dispatch('studies/clearStudies');
            await this.$store.dispatch('studies/clearFilterNoReload');
            var keyValueFilters = {};

            if ("source-type" in filters && "remote-source" in filters) {
                if (filters["source-type"].toLowerCase() === "dicom") {
                    this.sourceType = SourceType.REMOTE_DICOM;
                } else if (filters["source-type"].toLowerCase() === "dicom-web") {
                    this.sourceType = SourceType.REMOTE_DICOM_WEB;
                }
                this.remoteSource = filters["remote-source"];
            } else {
                this.sourceType = SourceType.LOCAL_ORTHANC;
                this.remoteSource = null;
            }
            await this.$store.dispatch('studies/updateSource', { 'source-type': this.sourceType, 'remote-source': this.remoteSource });

            let routeHasOrderBy = false;
            let labelsConstraint = filters["labels-constraint"] || 'All';
            for (const [filterKey, filterValue] of Object.entries(filters)) {
                if (filterKey == "labels") {
                    const labels = filterValue.split(",");
                    keyValueFilters[filterKey] = labels;
                    await this.$store.dispatch('studies/updateLabelFilterNoReload', { labels: labels, constraint: labelsConstraint });
                } else if (filterKey == 'labels-constraint') {
                    this.multiLabelsFilterLabelsConstraint = filterValue;
                } else if (filterKey == 'order-by') {
                    if (this.sourceType == SourceType.LOCAL_ORTHANC) { // ignore order-by for remote sources
                        this.updateOrderBy(filterValue, false);
                        routeHasOrderBy = true;
                    }
                } else if (filterKey[0] === filterKey[0].toUpperCase()) {  // DicomTags starts with a capital letter
                    keyValueFilters[filterKey] = filterValue;
                    await this.$store.dispatch('studies/updateFilterNoReload', { dicomTagName: filterKey, value: filterValue });
                } 
            }
            if (!routeHasOrderBy && this.uiOptions.DefaultOrdering) {
                const defaultOrdering = this.uiOptions.DefaultOrdering;
                console.log("Applying default ordering: ", defaultOrdering);
                this.updateOrderBy(defaultOrdering, false);
            }

            await this.updateFilterForm(keyValueFilters, labelsConstraint);

            if (this.sourceType == SourceType.LOCAL_ORTHANC || !this['studies/isFilterEmpty']) { // do not reload when we are switching to a remote study list to avoid searching for * on a remote server
                await this.reloadStudyList();
            }

            this.multiLabelsComponentKey++; // force refresh the multi-labels filter component

            await nextTick();
            this.updatingFilterUi = false;
        },
        updateFilterForm(filters, labelsConstraint) {
            // console.log("StudyList: updateFilterForm", this.updatingFilterUi);
            this.emptyFilterForm();

            this.multiLabelsFilterLabelsConstraint = labelsConstraint;
            for (const [key, value] of Object.entries(filters)) {
                if (key == "labels") {
                    this.filterLabels = value;
                } else if (key == "order-by") {
                    let orders = value.split(";")
                    for (let order of orders) {
                        let s = order.split(",");

                    }
                } else if (key == "StudyDate") {
                    this.filterStudyDate = value;
                    this.filterStudyDateForDatePicker = dateHelpers.parseDateForDatePicker(value);
                } else if (key == "PatientBirthDate") {
                    this.filterPatientBirthDate = value;
                    this.filterPatientBirthDateForDatePicker = dateHelpers.parseDateForDatePicker(value);
                } else if (key == "ModalitiesInStudy") {
                    const modalities = value.split('\\');
                    if (modalities.length > 0) {
                        let allModalitiesInFilter = true;
                        let noneModalitiesInFilter = true;
                        for (const modality of this.uiOptions.ModalitiesFilter) {
                            const isInFilter = modalities.indexOf(modality) != -1
                            this.filterModalities[modality] = isInFilter;
                            allModalitiesInFilter &= isInFilter;
                            noneModalitiesInFilter &= !isInFilter;
                        }
                        this.allModalities = allModalitiesInFilter;
                        this.noneModalities = noneModalitiesInFilter;
                    }
                } else {
                    this.filterGenericTags[key] = value;
                }
            }
        },
        emptyFilterForm() {
            // console.log("StudyList: emptyFilterForm", this.updatingFilterUi);
            this.filterStudyDate = '';
            this.filterStudyDateForDatePicker = null;
            this.filterPatientBirthDate = '';
            this.multiLabelsFilterLabelsConstraint = 'All';

            this.filterPatientBirthDateForDatePicker = null;
            this.filterGenericTags = {};
            if (this.uiOptions.StudyListColumns) {
                for (const tag of this.uiOptions.StudyListColumns) {
                    if (['StudyDate', 'PatientBirthDate', 'modalities', 'seriesCount', 'instancesCount', 'seriesAndInstancesCount', 'Hospital', 'UploadedBy'].indexOf(tag) == -1) {
                        this.filterGenericTags[tag] = '';
                    }
                }
            }
            this.filterHospital = '';
            this.filterUploadedBy = '';
            this.filterLabels = [];
            this.clearModalityFilter();
            if (!('AccessionNumber' in this.filterGenericTags)) this.filterGenericTags['AccessionNumber'] = '';
        },
        isFilteringOnlyOnLabels() {
            let hasGenericTagFilter = false;
            for (const tag of this.uiOptions.StudyListColumns) {
                if (['StudyDate', 'PatientBirthDate', 'modalities', 'seriesCount', 'instancesCount', 'seriesAndInstancesCount', 'Hospital', 'UploadedBy'].indexOf(tag) == -1) {
                    if (this.filterGenericTags[tag] && this.filterGenericTags[tag] != '') {
                        hasGenericTagFilter = true;
                    }
                }
            }
            if (this.filterHospital && this.filterHospital.trim() !== '') {
                hasGenericTagFilter = true;
            }
            if (this.filterUploadedBy && this.filterUploadedBy.trim() !== '') {
                hasGenericTagFilter = true;
            }
            return this.filterStudyDate == '' && this.filterPatientBirthDate == '' && !hasGenericTagFilter && this.filterLabels.length > 0 && this.filterOrderBy.length == 0;
        },
        async search() {
            if (this.isSearching) {
                await this.$store.dispatch('studies/cancelSearch');
            } else {
                {
                    // update filters with the value of filter controls when we click the search button
                    await this.$store.dispatch('studies/clearFilterNoReload');
                    for (const tag of this.uiOptions.StudyListColumns) {
                        if (['modalities', 'seriesCount', 'instancesCount', 'seriesAndInstancesCount'].indexOf(tag) == -1) {
                            await this.$store.dispatch('studies/updateFilterNoReload', { dicomTagName: tag, value: this.getFilterValue(tag) });    
                        }
                    }
                    await this.$store.dispatch('studies/updateFilterNoReload', { dicomTagName: "ModalitiesInStudy", value: this.getModalityFilter() });    
                    await this.$store.dispatch('studies/updateLabelFilterNoReload', { labels: this.filterLabels, constraint: this.multiLabelsFilterLabelsConstraint });
                }
                await this.updateUrlNoReload();
                await this.reloadStudyList();
            }
        },
        async clearFilters() {
            // console.log("StudyList: clearFilters", this.updatingFilterUi);
            await this.clearFiltersUi();
            await this.$store.dispatch('studies/clearFilterNoReload');

            if (this.sourceType == SourceType.LOCAL_ORTHANC) {
                this.reloadStudyList();
            }
        },
        async clearFiltersUi() {
            // console.log("StudyList: clearFiltersUi IN");
            this.updatingFilterUi = true;

            this.emptyFilterForm();
            this.updateUrl();
            await nextTick();

            this.updatingFilterUi = false;
            // console.log("StudyList: clearFiltersUi OUT");
        },
        async toggleModalityFilter(ev) {
            // only for all/none, other values are binded with v-model !
            const modality = ev.srcElement.getAttribute("data-value");
            let newValue = true;
            if (modality == "all") {
                newValue = true;
            } else if (modality == "none") {
                newValue = false;
            }

            for (const [key, value] of Object.entries(this.filterModalities)) {
                this.filterModalities[key] = newValue;
            }

            this.getModalityFilter(); // to update the state of "all"/"none"
        },
        modalityFilterClicked(ev) {  // prevent closing the drop-down at every click
            ev.stopPropagation();
        },
        closeModalityFilter(ev) {
            // simulate a click on the dropdown toggle (TODO: fix error in console)
            $("#dropdown-modalities-button").click();
            ev.preventDefault();
            ev.stopPropagation();
        },
        async updateUrlNoReload() {
            this.updatingRouteWithoutReload = true;
            await this.updateUrl();
            this.updatingRouteWithoutReload = false;
        },
        async updateUrl() {
            let query = {};

            if (this.sourceType != SourceType.LOCAL_ORTHANC) {
                if (this.sourceType == SourceType.REMOTE_DICOM) {
                    query['source-type'] = 'dicom';
                } else if (this.sourceType == SourceType.REMOTE_DICOM_WEB) {
                    query['source-type'] = 'dicom-web';
                }
                query['remote-source'] = this.remoteSource;
            }

            if (this.clipFilter("StudyDate", this.filterStudyDate)) {
                query['StudyDate'] = this.filterStudyDate;
            }
            if (this.clipFilter("PatientBirthDate", this.filterPatientBirthDate)) {
                query['PatientBirthDate'] = this.filterPatientBirthDate;
            }
            if (this.getModalityFilter()) {
                query['ModalitiesInStudy'] = this.getModalityFilter();
            }
            for (const [k, v] of Object.entries(this.filterGenericTags)) {
                if (this.clipFilter(k, v)) {
                    query[k] = v;
                }
            }
            if (this.filterLabels.length > 0) {
                query['labels'] = this.filterLabels.join(',');
                
                if (this.multiLabelsFilterLabelsConstraint != 'All') {
                    query['labels-constraint'] = this.multiLabelsFilterLabelsConstraint;
                }
            }

            // Only add order-by if it's NOT the default ordering (LastUpdate DESC)
            const isDefaultOrder = this.filterOrderBy.length === 1 
                && this.filterOrderBy[0].Type === 'Metadata' 
                && this.filterOrderBy[0].Key === 'LastUpdate' 
                && this.filterOrderBy[0].Direction === 'DESC';
            
            if (this.filterOrderBy.length > 0 && this.sourceType == SourceType.LOCAL_ORTHANC && !isDefaultOrder) {
                let orders = []
                for (let order of this.filterOrderBy) {
                    orders.push([order['Type'], order['Key'], order['Direction']].join(','))
                }
                query['order-by'] = orders.join(';');
            }

            // If no filters, navigate to studies; otherwise use filtered-studies
            if (Object.keys(query).length === 0) {
                await this.$router.replace('/studies');
            } else {
                let newUrl = "/filtered-studies?" + (new URLSearchParams(query)).toString();
                await this.$router.replace(newUrl);
            }
        },
        async extendStudyList() {
            if (this.sourceType == SourceType.LOCAL_ORTHANC && this.hasExtendedFind) {
                await this.$store.dispatch('studies/extendFilteredStudies');
            }
        },
        async reloadStudyList() {
            if (this.sourceType == SourceType.LOCAL_ORTHANC && this.hasExtendedFind) {
                if (this.uiOptions.StudyListContentIfNoSearch == "empty") {
                    this.status = Status.UNDEFINED;
                    if (this['studies/isFilterEmpty']) {
                        await this.$store.dispatch('studies/clearStudies');
                    } else {
                        await this.$store.dispatch('studies/clearStudies');
                        await this.$store.dispatch('studies/reloadFilteredStudies');
                    }
                } else {
                    if (this['studies/isMostRecentOrdering']) {
                        this.status = Status.LOADING_MOST_RECENT_STUDIES;
                    }
                    await this.$store.dispatch('studies/clearStudies');
                    await this.$store.dispatch('studies/reloadFilteredStudies');
                    if (this['studies/isMostRecentOrdering']) {
                        this.status = Status.DISPLAYING_MOST_RECENT_STUDIES;
                    } else {
                        this.status = Status.DISPLAYING_FILTERED_STUDIES;
                    }
                }
            } else {
                // if we are displaying most recent studies and there is only a label filter -> continue to show the list of most recent studies (filtered by label)
                const shouldShowMostRecentsWithLabel = this.uiOptions.StudyListContentIfNoSearch == "most-recents" && this.isFilteringOnlyOnLabels();

                if (this.sourceType == SourceType.LOCAL_ORTHANC && (this['studies/isFilterEmpty'] || shouldShowMostRecentsWithLabel)) {
                    await this.$store.dispatch('studies/clearStudies');
                    if (this.uiOptions.StudyListContentIfNoSearch == "empty") {
                        return;
                    } else if (this.uiOptions.StudyListContentIfNoSearch == "most-recents" && this.hasExtendedFind) {
                        const studies = await api.getMostRecentStudiesExtended((this.filterLabels.length > 0 ? this.filterLabels[0] : null));
                        for (const study of studies) {
                            this.$store.dispatch('studies/addStudy', { studyId: study["ID"], study: study, reloadStats: false });
                        }
                    } else if (this.uiOptions.StudyListContentIfNoSearch == "most-recents") {
                        // legacy code

                        if (this.status == Status.LOADING_MOST_RECENT_STUDIES) {
                            // if currently loading, stop it
                            this.shouldStopLoadingMostRecentStudies = true;
                            this.status = Status.DISPLAYING_MOST_RECENT_STUDIES;
                        }
                        // restart loading 
                        const lastChangeId = await api.getLastChangeId();
                    
                        await this.$store.dispatch('studies/clearStudies');
                        this.mostRecentStudiesIds = new Set();
                        this.shouldStopLoadingMostRecentStudies = false;
                        this.status = Status.LOADING_MOST_RECENT_STUDIES;

                        this.loadStudiesFromChange(lastChangeId, 1000);
                    }
                } else {
                    this.shouldStopLoadingMostRecentStudies = true;
                    this.status = Status.UNDEFINED;
                    await this.$store.dispatch('studies/reloadFilteredStudies');
                }
            }
        },
        async loadStudiesFromChange(toChangeId, limit) {
            let changes;
            let changesResponse;
            if (this.hasExtendedChanges) {
                changesResponse = await api.getChangesExtended(toChangeId, limit, ["NewStudy", "StableStudy"]);
                changes = changesResponse["Changes"];
            } else {
                changesResponse = await api.getChanges(toChangeId - limit, limit);
                changes = changesResponse["Changes"].reverse();
            }
            
            for (let change of changes) {
                // Take the first event we find -> we see last uploaded data immediately (NewStudy but no StableStudy).  
                // An updated study that has received a new series is visible as well (its NewStudy might be too old but the StableStudy brings it back on top of the list)
                if ((change["ChangeType"] == "NewStudy" || change["ChangeType"] == "StableStudy") && !this.mostRecentStudiesIds.has(change["ID"])) {
                    if (this.shouldStopLoadingMostRecentStudies) {
                        return;
                    }
                    //console.log(change);
                    try {
                        const study = await api.getStudy(change["ID"]);
                        if (this.filterLabels.length == 0 || this.filterLabels.filter(l => study["Labels"].includes(l)).length > 0) {
                            this.$store.dispatch('studies/addStudy', { studyId: change["ID"], study: study, reloadStats: false });
                        }

                        this.mostRecentStudiesIds.add(change["ID"]);
                        if (this.mostRecentStudiesIds.size == this.uiOptions.MaxStudiesDisplayed) {
                            this.status = Status.DISPLAYING_MOST_RECENT_STUDIES;
                            return;
                        }
                    } catch (err) {
                        console.warn("Unable to load study - not authorized ?");
                    }
                }
            }
            if (!this.shouldStopLoadingMostRecentStudies) {
                if (this.mostRecentStudiesIds.size < this.statistics.CountStudies) {
                    if (this.hasExtendedChanges) {
                        if (!changesResponse["Done"]) {
                            setTimeout(() => {this.loadStudiesFromChange(changesResponse["First"], 1000)}, 1);
                        }
                    } else {
                        if (toChangeId != changesResponse["First"]) {
                            setTimeout(() => {this.loadStudiesFromChange(Math.max(0, toChangeId-1000), 1000)}, 1);
                        }
                    }
                } else {
                    this.status = Status.DISPLAYING_MOST_RECENT_STUDIES;                    
                }
            } else {
                this.status = Status.DISPLAYING_MOST_RECENT_STUDIES;
            }
        },
        onDeletedStudy(studyId) {
            this.$store.dispatch('studies/deleteStudy', { studyId: studyId });
        },
        visibilityChanged(isVisible, entry) {
            if (isVisible) {
                let studyId = entry.target.id;
                if (studyId == this.studiesIds[this.studiesIds.length - 1]) {
                    // console.log("Last element shown -> should load more studies");
                    this.extendStudyList();
                }
            }
        },
        onMultiLabelsFilterChanged(newValues) {
            this.filterLabels = newValues;
            if (this.isSearchAsYouTypeEnabled) {
                this.updateUrlNoReload();
                this.reloadStudyList();
            }
        },
        getStudy(studyId) {
            return (this.storeStudies || []).find(s => s.ID === studyId) || null;
        },
        formatStudyDateShort(study) {
            if (!study || !study.MainDicomTags) return '—';
            return dateHelpers.formatDateForDisplay(study.MainDicomTags.StudyDate, this.uiOptions.DateFormat) || '—';
        },
        formatPatientBirthDateShort(study) {
            if (!study || !study.PatientMainDicomTags) return '—';
            return dateHelpers.formatDateForDisplay(study.PatientMainDicomTags.PatientBirthDate, this.uiOptions.DateFormat) || '—';
        },
        formatPatientName(study) {
            if (!study || !study.PatientMainDicomTags) return '—';
            return resourceHelpers.formatPatientName(study.PatientMainDicomTags.PatientName) || '—';
        },
        modalityDisplay(study) {
            if (!study) return '—';
            if (study.RequestedTags && study.RequestedTags.ModalitiesInStudy) {
                return study.RequestedTags.ModalitiesInStudy.split('\\').join(', ');
            }
            return '—';
        },
        seriesInstancesDisplay(study) {
            if (!study) return '—';
            const seriesCount = study.sourceType === SourceType.REMOTE_DICOM || study.sourceType === SourceType.REMOTE_DICOM_WEB
                ? (study.MainDicomTags && study.MainDicomTags.NumberOfStudyRelatedSeries)
                : (study.Series && study.Series.length);
            const instancesCount = study.RequestedTags && study.RequestedTags.NumberOfStudyRelatedInstances;
            if (instancesCount != null) return String(seriesCount ?? '—') + '/' + String(instancesCount);
            return seriesCount != null ? String(seriesCount) : '—';
        },
        openUploadPanel() {
            this.messageBus.emit('open-upload-panel');
            this.$nextTick(() => {
                setTimeout(() => document.getElementById('filesUpload')?.click(), 350);
            });
        },
        goToStudy(studyId) {
            const study = this.getStudy(studyId);
            const uid = study && study.MainDicomTags && study.MainDicomTags.StudyInstanceUID;
            if (uid) {
                this.$router.push({ path: '/filtered-studies', query: { StudyInstanceUID: uid, expand: 'study' } });
            }
        },
        toggleRowMenu(studyId) {
            this.openRowMenuId = this.openRowMenuId === studyId ? null : studyId;
        },
        closeRowMenu() {
            this.openRowMenuId = null;
        },
        toggleExpand(studyId) {
            this.expandedStudyId = this.expandedStudyId === studyId ? null : studyId;
        },
        patientStudyCount(patientId) {
            if (!patientId || !this.storeStudies) return 0;
            return this.storeStudies.filter(s => (s.PatientMainDicomTags && s.PatientMainDicomTags.PatientID) === patientId).length;
        },
    },
    components: { ResourceButtonGroup, LabelsEditor, Toasts, CopyToClipboardButton }
}
</script>


<template>
    <div>
        <div v-if="isRemoteDicom || isRemoteDicomWeb" class="studies-remote-warning">
            <p v-if="isRemoteDicom" v-html="$t('remote_dicom_browsing', { source: remoteSource})"></p>
            <p v-if="isRemoteDicomWeb" v-html="$t('remote_dicom_web_browsing', { source: remoteSource})"></p>
        </div>
        <div class="studies-page-modern" @click.self="closeRowMenu">
            <header class="studies-header">
                <div class="studies-header-top">
                    <div>
                        <h1 class="studies-title">{{ $t('all_studies') || 'All Studies' }}</h1>
                        <p class="studies-subtitle">Manage and view all DICOM studies</p>
                    </div>
                    <div class="studies-header-actions">
                        <button type="button" class="studies-btn studies-btn-ghost studies-btn-icon" @click="reloadStudyList" title="Refresh" :disabled="isSearching">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        </button>
                        <button type="button" class="studies-btn studies-btn-primary" @click="openUploadPanel">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                            Upload Study
                        </button>
                    </div>
                </div>
                <!-- Filter row: same style as modern project (rounded inputs, one per criterion) -->
                <div class="studies-filter-row">
                    <div class="studies-filter-cell studies-filter-date">
                        <svg class="studies-filter-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <Datepicker v-model="filterStudyDateForDatePicker" :enable-time-picker="false" range :preset-dates="datePickerPresetRanges" :format="datePickerFormat" :preview-format="datePickerFormat" text-input arrow-navigation hide-input-icon :highlight="{ weekdays: [6, 0]}" :dark="isDarkMode" :placeholder="$t('date_range') || 'Date range'" class="studies-filter-input-wrap">
                            <template #yearly="{ label, range, presetDate }">
                                <span @click="presetDate(range)">{{ label }}</span>
                            </template>
                        </Datepicker>
                    </div>
                    <div class="studies-filter-cell">
                        <input type="text" class="studies-filter-input" v-model="filterGenericTags['PatientName']" :placeholder="$t('patient_name_placeholder') || 'John^Doe'" @keyup.enter="search" />
                    </div>
                    <div class="studies-filter-cell">
                        <input type="text" class="studies-filter-input" v-model="filterGenericTags['PatientID']" placeholder="1234" @keyup.enter="search" />
                    </div>
                    <div class="studies-filter-cell">
                        <input type="text" class="studies-filter-input" v-model="filterGenericTags['StudyDescription']" :placeholder="$t('study_description_placeholder') || 'Chest'" @keyup.enter="search" />
                    </div>
                    <div class="studies-filter-cell">
                        <input type="text" class="studies-filter-input" v-model="filterHospital" :placeholder="$t('search_hospital') || 'Search hosp.'" @keyup.enter="search" />
                    </div>
                    <div class="studies-filter-cell">
                        <input type="text" class="studies-filter-input" v-model="filterUploadedBy" :placeholder="$t('search_user') || 'Search user.'" @keyup.enter="search" />
                    </div>
                    <div class="studies-filter-cell studies-filter-modality">
                        <div class="studies-modality-dropdown dropdown">
                            <button type="button" class="studies-btn studies-btn-outline studies-modality-btn dropdown-toggle" data-bs-toggle="dropdown" id="dropdown-modalities-button" aria-expanded="false">
                                <svg class="studies-filter-list-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                                {{ $t('modality') || 'Modality' }} <svg class="studies-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                            </button>
                            <ul class="dropdown-menu studies-modality-menu" aria-labelledby="dropdown-modalities-button" @click="modalityFilterClicked">
                                <li><label class="dropdown-item"><input type="checkbox" data-value="all" @click="toggleModalityFilter" v-model="allModalities" /> {{ $t('all_modalities') }}</label></li>
                                <li><label class="dropdown-item"><input type="checkbox" data-value="none" @click="toggleModalityFilter" v-model="noneModalities" /> {{ $t('no_modalities') }}</label></li>
                                <li><hr class="dropdown-divider"></li>
                                <li v-for="modality in uiOptions.ModalitiesFilter" :key="modality">
                                    <label class="dropdown-item"><input type="checkbox" :data-value="modality" v-model="filterModalities[modality]" /> {{ modality }}</label>
                                </li>
                                <li><button type="button" class="studies-btn studies-btn-primary studies-btn-sm mx-2 mt-1" @click="closeModalityFilter">{{ $t('close') }}</button></li>
                            </ul>
                        </div>
                    </div>
                    <div class="studies-filter-cell">
                        <input type="text" class="studies-filter-input" v-model="filterGenericTags['AccessionNumber']" placeholder="1234" @keyup.enter="search" />
                    </div>
                    <div class="studies-filter-actions">
                        <button v-if="isSearchButtonEnabled" type="button" class="studies-btn studies-btn-outline studies-btn-sm" @click="search" :disabled="isSearching">
                            <span v-if="!isSearching" class="studies-btn-search-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
                            <span v-else class="studies-spinner-sm"></span>
                            {{ isSearching ? $t('searching') : $t('search') }}
                        </button>
                        <button type="button" class="studies-btn studies-btn-ghost studies-btn-sm" @click="clearFilters">{{ $t('clear') || 'Clear' }}</button>
                    </div>
                </div>
                <div v-if="isMultiLabelsFilterVisible" class="studies-filters-row">
                    <label class="studies-filters-label">{{ $t('labels.study_details_title') }}</label>
                    <LabelsEditor id="multiLabelsFilter" :labels="filterLabels" :key="multiLabelsComponentKey" :studyId="null" @labelsUpdated="onMultiLabelsFilterChanged" :showTitle="false" :isFilter="true"></LabelsEditor>
                    <div class="studies-filters-constraint">
                        <input type="radio" name="multiLabelsFilterAll" id="multiLabelsFilterAll" value="All" v-model="multiLabelsFilterLabelsConstraint" />
                        <label for="multiLabelsFilterAll">{{ $t('labels.filter_labels_constraint_all') }}</label>
                        <input type="radio" name="multiLabelsFilterAny" id="multiLabelsFilterAny" value="Any" v-model="multiLabelsFilterLabelsConstraint" />
                        <label for="multiLabelsFilterAny">{{ $t('labels.filter_labels_constraint_any') }}</label>
                    </div>
                </div>
            </header>

            <div v-if="selectedStudiesIds.length > 0" class="studies-selection-bar">
                <p class="studies-selection-text"><span class="studies-selection-count">{{ selectedStudiesIds.length }}</span> {{ $t('studies_selected') || 'studies selected' }}</p>
                <div class="studies-selection-actions">
                    <ResourceButtonGroup :resourceLevel="'bulk'" smallIcons="true"></ResourceButtonGroup>
                </div>
            </div>

            <div v-if="!isSearching && (isLoadingMostRecentStudies || (showEmptyStudyListIfNoSearch && this['studies/isFilterEmpty']) || notShowingAllResults)" class="studies-alerts">
                <div v-if="isLoadingMostRecentStudies" class="studies-alert studies-alert-info">{{ $t('loading_most_recent_studies') }}</div>
                <div v-else-if="showEmptyStudyListIfNoSearch && this['studies/isFilterEmpty']" class="studies-alert studies-alert-warning">{{ $t('enter_search') }}</div>
                <div v-else-if="notShowingAllResults" class="studies-alert studies-alert-danger">{{ $t('not_showing_all_results') }}</div>
            </div>
            <div v-else-if="!isSearching && isDisplayingMostRecentStudies" class="studies-alerts">
                <div class="studies-alert studies-alert-info">{{ $t('displaying_most_recent_studies') }}</div>
            </div>

            <div class="studies-table-card">
                <div v-if="isSearching" class="studies-loading">
                    <div class="studies-spinner"></div>
                    <p>{{ $t('searching') }}</p>
                </div>
                <template v-else-if="!isStudyListEmpty && !showEmptyStudyListIfNoSearch">
                    <table class="studies-table">
                        <thead>
                            <tr class="studies-thead-row">
                                <th class="studies-th studies-th-checkbox"><input type="checkbox" class="studies-checkbox" :checked="allSelected === true" :indeterminate.prop="isPartialSelected" @change="clickSelectAll" /></th>
                                <th class="studies-th">Birth Date</th>
                                <th class="studies-th">Patient Name</th>
                                <th class="studies-th">Patient ID</th>
                                <th class="studies-th">Study Description</th>
                                <th class="studies-th">Study Date</th>
                                <th class="studies-th">Hospital</th>
                                <th class="studies-th">Uploaded By</th>
                                <th class="studies-th">Modality</th>
                                <th class="studies-th">Accession #</th>
                                <th class="studies-th"># Ser/Inst</th>
                                <th class="studies-th studies-th-actions"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="study in paginatedStudies" :key="study.ID">
                                <tr class="studies-tr" :id="'study-row-' + study.ID" :class="{ 'studies-tr-expanded': expandedStudyId === study.ID }" @click="toggleExpand(study.ID)">
                                    <td class="studies-td studies-td-checkbox" @click.stop>
                                        <input type="checkbox" class="studies-checkbox" :checked="selectedStudiesIds.includes(study.ID)" @change="$store.dispatch('studies/selectStudy', { studyId: study.ID, isSelected: $event.target.checked })" @click.stop />
                                    </td>
                                    <td class="studies-td studies-td-muted">{{ formatPatientBirthDateShort(study) }}</td>
                                    <td class="studies-td">{{ formatPatientName(study) }}</td>
                                    <td class="studies-td studies-td-muted">{{ (study.PatientMainDicomTags && study.PatientMainDicomTags.PatientID) || '—' }}</td>
                                    <td class="studies-td">{{ (study.MainDicomTags && study.MainDicomTags.StudyDescription) || '—' }}</td>
                                    <td class="studies-td studies-td-muted">{{ formatStudyDateShort(study) }}</td>
                                    <td class="studies-td studies-td-muted">{{ (study._hospitalName) || '—' }}</td>
                                    <td class="studies-td studies-td-muted">{{ (study._uploadedBy) || '—' }}</td>
                                    <td class="studies-td">{{ modalityDisplay(study) }}</td>
                                    <td class="studies-td studies-td-muted">{{ (study.MainDicomTags && study.MainDicomTags.AccessionNumber) || '—' }}</td>
                                    <td class="studies-td studies-td-muted">{{ seriesInstancesDisplay(study) }}</td>
                                    <td class="studies-td studies-td-actions" @click.stop>
                                        <div class="studies-row-menu-wrap">
                                            <button type="button" class="studies-btn studies-btn-ghost studies-btn-icon studies-row-menu-btn" @click="toggleRowMenu(study.ID)" title="Actions">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                            </button>
                                            <div v-show="openRowMenuId === study.ID" class="studies-row-menu" @click.stop>
                                                <button type="button" class="studies-row-menu-item" @click="closeRowMenu(); goToStudy(study.ID)">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    View
                                                </button>
                                                <button type="button" class="studies-row-menu-item studies-row-menu-item-danger" @click="closeRowMenu(); $router.push('/study/' + study.ID); onDeletedStudy(study.ID)">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                <!-- Expanded row: labels, study/patient details, actions -->
                                <tr v-if="expandedStudyId === study.ID" class="studies-detail-row" @click.stop>
                                    <td colspan="12" class="studies-detail-cell">
                                        <div class="studies-detail-content">
                                            <div class="studies-detail-labels">
                                                <LabelsEditor :labels="study.Labels || []" :studyId="study.ID" :showTitle="false" :key="'labels-' + study.ID" />
                                            </div>
                                            <div class="studies-detail-grid">
                                                <div class="studies-detail-col">
                                                    <div class="studies-detail-item" v-if="study.MainDicomTags"><span class="studies-detail-label">Study Date:</span> <span class="studies-detail-value">{{ (study.MainDicomTags.StudyDate) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.MainDicomTags && study.MainDicomTags.StudyDate) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.MainDicomTags"><span class="studies-detail-label">Study Time:</span> <span class="studies-detail-value">{{ (study.MainDicomTags.StudyTime) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.MainDicomTags && study.MainDicomTags.StudyTime) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.MainDicomTags"><span class="studies-detail-label">Study Description:</span> <span class="studies-detail-value">{{ (study.MainDicomTags.StudyDescription) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.MainDicomTags && study.MainDicomTags.StudyDescription) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.MainDicomTags"><span class="studies-detail-label">Accession Number:</span> <span class="studies-detail-value">{{ (study.MainDicomTags.AccessionNumber) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.MainDicomTags && study.MainDicomTags.AccessionNumber) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.MainDicomTags"><span class="studies-detail-label">Study ID:</span> <span class="studies-detail-value">{{ (study.MainDicomTags.StudyID) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.MainDicomTags && study.MainDicomTags.StudyID) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.MainDicomTags"><span class="studies-detail-label">Study Instance UID:</span> <span class="studies-detail-value studies-detail-value-truncate">{{ (study.MainDicomTags.StudyInstanceUID) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.MainDicomTags && study.MainDicomTags.StudyInstanceUID) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.MainDicomTags"><span class="studies-detail-label">Requesting Physician:</span> <span class="studies-detail-value">{{ (study.MainDicomTags.RequestingPhysician) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.MainDicomTags && study.MainDicomTags.RequestingPhysician) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.MainDicomTags"><span class="studies-detail-label">Referring Physician:</span> <span class="studies-detail-value">{{ (study.MainDicomTags.ReferringPhysicianName) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.MainDicomTags && study.MainDicomTags.ReferringPhysicianName) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.MainDicomTags"><span class="studies-detail-label">Institution Name:</span> <span class="studies-detail-value">{{ (study.MainDicomTags.InstitutionName) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.MainDicomTags && study.MainDicomTags.InstitutionName) || ''" /></div>
                                                </div>
                                                <div class="studies-detail-col">
                                                    <div class="studies-detail-item" v-if="study.PatientMainDicomTags"><span class="studies-detail-label">Patient ID:</span> <span class="studies-detail-value">{{ (study.PatientMainDicomTags.PatientID) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.PatientMainDicomTags && study.PatientMainDicomTags.PatientID) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.PatientMainDicomTags"><span class="studies-detail-label">Patient Name:</span> <span class="studies-detail-value">{{ (study.PatientMainDicomTags.PatientName) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.PatientMainDicomTags && study.PatientMainDicomTags.PatientName) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.PatientMainDicomTags"><span class="studies-detail-label">Patient Birth Date:</span> <span class="studies-detail-value">{{ (study.PatientMainDicomTags.PatientBirthDate) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.PatientMainDicomTags && study.PatientMainDicomTags.PatientBirthDate) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.PatientMainDicomTags"><span class="studies-detail-label">Patient Sex:</span> <span class="studies-detail-value">{{ (study.PatientMainDicomTags.PatientSex) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.PatientMainDicomTags && study.PatientMainDicomTags.PatientSex) || ''" /></div>
                                                    <div class="studies-detail-item" v-if="study.PatientMainDicomTags"><span class="studies-detail-label">Patient Other IDs:</span> <span class="studies-detail-value">{{ (study.PatientMainDicomTags.OtherPatientIDs) || '—' }}</span> <CopyToClipboardButton :valueToCopy="(study.PatientMainDicomTags && study.PatientMainDicomTags.OtherPatientIDs) || ''" /></div>
                                                    <p class="studies-detail-patient-link" v-if="study.PatientMainDicomTags && patientStudyCount(study.PatientMainDicomTags.PatientID) > 1">
                                                        This patient has {{ patientStudyCount(study.PatientMainDicomTags.PatientID) }} studies in total. <router-link :to="{ path: '/filtered-studies', query: { PatientID: study.PatientMainDicomTags.PatientID } }">Show them!</router-link>
                                                    </p>
                                                </div>
                                            </div>
                                            <div class="studies-detail-actions">
                                                <ResourceButtonGroup :resourceOrthancId="study.ID" :resourceLevel="'study'" :studyMainDicomTags="study.MainDicomTags" :patientMainDicomTags="study.PatientMainDicomTags" smallIcons="true" />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </template>
                <template v-else-if="isStudyListEmpty && !showEmptyStudyListIfNoSearch">
                    <div class="studies-empty">
                        <svg class="studies-empty-icon" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="18" y2="12"/><line x1="9" x2="15" y1="15" y2="15"/></svg>
                        <h3 class="studies-empty-title">{{ $t('no_result_found') || 'No Studies Found' }}</h3>
                        <p class="studies-empty-text">{{ $t('no_studies_matching') || 'There are no studies matching your criteria. Try adjusting your filters or upload new studies.' }}</p>
                    </div>
                </template>
            </div>

            <div v-if="!isSearching && !isStudyListEmpty && !showEmptyStudyListIfNoSearch" class="studies-pagination">
                <p class="studies-pagination-text">Showing <span class="studies-pagination-bold">{{ paginationStart }}</span>-<span class="studies-pagination-bold">{{ paginationEnd }}</span> of <span class="studies-pagination-bold">{{ studiesIds.length }}</span> studies</p>
                <div class="studies-pagination-nav">
                    <button type="button" class="studies-btn studies-btn-outline studies-btn-sm" :disabled="currentPage <= 1" @click="currentPage = Math.max(1, currentPage - 1)">Previous</button>
                    <template v-for="(num, idx) in paginationPageNumbers" :key="num === '...' ? 'ellipsis-' + idx : num">
                        <button v-if="num === '...'" type="button" class="studies-btn studies-btn-ghost studies-btn-sm studies-btn-pagination" disabled>...</button>
                        <button v-else type="button" class="studies-btn studies-btn-ghost studies-btn-sm studies-btn-pagination" :class="{ 'studies-btn-pagination-active': currentPage === num }" @click="currentPage = num">{{ num }}</button>
                    </template>
                    <button type="button" class="studies-btn studies-btn-outline studies-btn-sm" :disabled="currentPage >= totalPages" @click="currentPage = Math.min(totalPages, currentPage + 1)">Next</button>
                </div>
            </div>

            <Toasts />
        </div>
    </div>
</template>

<style>
:root {
    --filter-margin: 5px;
    --filter-padding: 2px;
}

input.form-control.study-list-filter {
  margin-top: var(--filter-margin);
  margin-bottom: var(--filter-margin);
  padding-top: var(--filter-padding);
  padding-bottom: var(--filter-padding);
  padding-left: 8px;
  padding-right: 8px;
  border-bottom-width: thin;
  font-size: 13px;
  height: 36px;
}

.filter-button {
  border-bottom-width: thin !important;
  border-color: var(--bs-border-color);
}

/* Clear filter button - fixed size to prevent shrinking */
.clear-filter-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  background-color: var(--bs-body-bg);
  color: var(--bs-body-color);
  cursor: pointer;
  transition: all 0.2s;
  margin-top: var(--filter-margin);
  margin-bottom: var(--filter-margin);
}

.clear-filter-btn:hover {
  background-color: var(--bs-light);
}

.clear-filter-btn i {
  font-size: 14px;
}

.search-button {
  padding-left: 0px !important;
}

.is-not-searching {
  background-color: var(--table-filters-is-not-searching-color) !important;
  border-color: var(--table-filters-is-not-searching-color) !important;
}

.is-searching {
  background-color: var(--table-filters-is-searching-color) !important;
  border-color: var(--table-filters-is-searching-color) !important;
}

button.form-control.study-list-filter {
  margin-top: var(--filter-margin);
  margin-bottom: var(--filter-margin);
  padding-top: var(--filter-padding);
  padding-bottom: var(--filter-padding);
  height: 38px !important;
  line-height: 1.5;
  box-sizing: border-box;
}


.study-column-titles {
  background-color: var(--study-table-header-bg-color) !important;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}


.study-table-title {
  text-align: left;
  padding-left: 4px;
  padding-right: 4px;
  padding-top: 14px;
  padding-bottom: 14px;
  vertical-align: middle !important;
  line-height: 1.5;
  position: sticky;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-weight: 400;
}

.study-column-titles th {
  vertical-align: middle !important;
}

/* .study-table> :not(:first-child) {
  border-top: 0px !important;
} */

.study-table {
  table-layout: fixed;
}

.study-table> :nth-child(odd) >tr >td{
  background-color: var(--study-odd-bg-color);
}

.study-table> :nth-child(even) >tr >td{
  background-color: var(--study-even-bg-color);
}

/* only on the first child of each tbody to prevent hover over the labels row */
.study-table>tbody>tr:first-child:hover > * {
  background-color: var(--study-hover-color);
}

.study-table > tbody > tr.study-row-expanded:hover > *{
  background-color: var(--study-details-bg-color);
}
.study-table > tbody > tr.study-details-expanded:hover > *{
  background-color: var(--study-details-bg-color);
}

.study-table> :last-child {
  border-bottom-width: thin;
}

.study-table tr:hover {
  background-color: var(--study-hover-color);
}


.study-table-filters {
  background-color: var(--study-table-filter-bg-color);
}

.study-table-filters > th {
  background-color: var(--study-table-filter-bg-color);
}

.study-table-filters > th >  button{
  background-color: var(--bs-table-bg);
}

.study-table-filters > th {
  text-align: left;
  padding-left: 6px !important;
  padding-top: 0px;
  padding-bottom: 0px;
  margin-bottom: 5px;
  vertical-align: middle;    
}

/* Date picker styling to match other inputs */
.study-table-filters .dp__input_wrap {
  height: 38px;
  display: flex;
  align-items: center;
}

.study-table-filters .dp__input {
  height: 38px !important;
  min-height: 38px !important;
  max-height: 38px !important;
  padding: 10px 14px !important;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  line-height: 1.5;
  box-sizing: border-box;
}

.study-table-filters .dp__input:focus {
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06);
  outline: none;
  background: white;
}

/* Date picker calendar z-index - must be very high to ensure visibility */
.dp__menu {
  z-index: 999999 !important;
  position: absolute !important;
  top: 100% !important;
  left: 0 !important;
  margin-top: 4px !important;
}

.dp__calendar_wrap {
  z-index: 999999 !important;
  position: relative !important;
}

.dp__calendar {
  z-index: 999999 !important;
}

.dp__overlay {
  z-index: 999998 !important;
}

.dp__menu_transitioned {
  z-index: 999999 !important;
  position: absolute !important;
  top: 100% !important;
  left: 0 !important;
  margin-top: 4px !important;
}

.dp__outer_menu_wrap {
  z-index: 999999 !important;
  position: absolute !important;
  top: 100% !important;
  left: 0 !important;
  margin-top: 4px !important;
}

/* Ensure datepicker container is positioned relative for absolute positioning */
.study-table-filters th > div:has(.dp__input_wrap) {
  position: relative !important;
}

.study-table-filters .dp__input_wrap {
  position: relative !important;
}

/* Ensure no parent elements block the calendar */
.study-table-filters {
  position: relative;
  z-index: 1;
}

.study-table-filters th {
  position: relative;
  z-index: auto;
  overflow: visible !important;
}

.study-table-filters th > div {
  position: relative;
  z-index: auto;
  overflow: visible !important;
}

/* Ensure date picker container doesn't affect height */
.study-table-filters th > div:has(.dp__input_wrap) {
  height: 38px;
  display: flex;
  align-items: center;
}

.study-table td {
  text-align: left;
  padding-left: 10px;
}

.study-list-alert {
  margin-top: var(--filter-margin);
  margin-bottom: var(--filter-margin);
  padding-top: var(--filter-padding);
}

.modern-badge {
  background: rgba(74, 144, 226, 0.1) !important;
  border: 1px solid rgba(74, 144, 226, 0.2) !important;
  border-radius: 8px !important;
  color: #357abd !important;
  padding: 10px 16px !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
  backdrop-filter: blur(8px) !important;
}

.modern-badge .alert-icon {
  margin-right: 8px;
  color: #4a90e2;
  padding-bottom: var(--filter-padding);
}

.study-list-bulk-buttons {
  margin-top: var(--filter-margin);
}

.is-invalid-filter {
  /* background-color: #f7dddf !important; */
  border-color: red !important;
  box-shadow: 0 0 0 .25rem rgba(255, 0, 0, .25) !important;
}

.alert-icon {
  margin-right: 0.7rem;
}

.study-table-actions > th {
  background-color: var(--study-table-actions-bg-color) !important;
  vertical-align: middle;
}

.study-table-actions > th > div {
  background-color: var(--study-table-actions-bg-color) !important;
  text-align: left;
}

.study-details-table {
  margin-top: var(--details-top-margin);
  margin-left: 5%;
  width: 95% !important;
  font-size: 0.9rem;
}

.study-details-table>:not(caption) >* >* {
  background-color: var(--study-details-bg-color) !important;
}

.study-details-table >* >* {
  background-color: var(--study-details-bg-color) !important;
}

.study-details-table td {
  vertical-align: top;
}

.remote-browsing-warning {
    background-color: var(--study-list-remote-bg-color);
    text-align: center;
    font-weight: 500;
    height: 2rem;
    line-height: 2rem;
}

.title-container {
    position: relative;
    width: 100%;
    min-height: 100%;
    display: flex;
    align-items: center;
}

.title-text {
    position: relative;
    padding-left: 2px;
    padding-right: 2px;
    width: 100%;
    border-left: 1px;
    border-right: 0px;
    border-top: 0px;
    border-bottom: 0px;
    border-style: solid;
    border-color: var(--study-table-actions-bg-color);
    text-overflow: ellipsis;
    overflow: hidden;
    line-height: 1.5;
}

.is-orderable {
    cursor: pointer;
    user-select: none;
}

.title-arrow {
    position: absolute;
    font-size: medium;
    bottom: 0;
    right: 0;
    padding-right: 5px;
}

/* Empty state styles */
.empty-state-tbody tr.empty-state-row:hover,
.empty-state-tbody tr.empty-state-row:hover > td {
    background-color: transparent !important;
    cursor: default;
}

.empty-state {
    text-align: center;
    padding: 60px 20px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 12px;
    margin: 20px;
}

.empty-state-icon {
    font-size: 64px;
    color: #adb5bd;
    margin-bottom: 20px;
}

.empty-state-title {
    font-size: 20px;
    font-weight: 600;
    color: #495057;
    margin-bottom: 10px;
}

.empty-state-text {
    font-size: 14px;
    color: #6c757d;
    max-width: 400px;
    margin: 0 auto;
    line-height: 1.6;
}
</style>

<style scoped>
/* Modern DICOM studies page – same design system as document page (v0-modernize-emedx) */
.studies-page-modern {
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: left;
    color: var(--content-foreground);
    background: var(--content-background);
    min-height: 100vh;
    margin: -24px;
    padding: 1.5rem 1rem;
}
@media (min-width: 1024px) {
    .studies-page-modern {
        padding-left: 2rem;
        padding-right: 2rem;
    }
}
.studies-remote-warning {
    margin: -24px -24px 0 -24px;
    padding: 0.5rem 1rem;
    background: var(--content-secondary);
    border-bottom: 1px solid var(--content-border);
    font-size: 0.875rem;
    color: var(--content-muted-foreground);
}
.studies-header {
    position: sticky;
    top: 0;
    z-index: 30;
    margin-bottom: 1.5rem;
    padding: 1rem 0;
    background: oklch(0.96 0.01 80 / 0.8);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--content-border);
}
[data-bs-theme="dark"] .studies-header {
    background: oklch(0.12 0.01 60 / 0.8);
}
.studies-header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.studies-title { font-size: 1.25rem; font-weight: 600; color: var(--content-foreground); margin: 0 0 2px; }
.studies-subtitle { font-size: 0.875rem; color: var(--content-muted-foreground); margin: 0; }
.studies-header-actions { display: flex; align-items: center; gap: 0.75rem; }
.studies-toolbar { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; }
.studies-search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 28rem; }
.studies-search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--content-muted-foreground); }
.studies-search-input { width: 100%; min-height: 2.25rem; padding: 0.5rem 1rem 0.5rem 2.25rem; font-size: 0.875rem; font-family: inherit; color: var(--content-foreground); background: var(--content-secondary); border: 1px solid transparent; border-radius: 9999px; outline: none; box-shadow: var(--content-shadow-xs); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.studies-search-input::placeholder { color: var(--content-muted-foreground); }
.studies-search-input:hover { border-color: var(--content-border); }
.studies-search-input:focus { border-color: var(--content-primary); box-shadow: 0 0 0 3px rgba(8, 5, 3, 0.12); }
.studies-toolbar-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.studies-date-wrap :deep(.dp__input_wrap) { height: 2.25rem; display: flex; align-items: center; }
.studies-date-wrap :deep(.dp__input) { min-height: 2.25rem; padding: 0.5rem 1rem 0.5rem 2rem; font-size: 0.875rem; border-radius: 9999px; border: 1px solid var(--content-border); background: var(--content-secondary); }
.studies-date-wrap :deep(.dp__input:focus) { border-color: var(--content-primary); box-shadow: 0 0 0 3px rgba(8, 5, 3, 0.12); }
.studies-modality-dropdown .studies-modality-btn { padding: 0.5rem 1rem 0.5rem 0.75rem; font-size: 0.875rem; border-radius: 9999px; border: 1px solid var(--content-border); background: var(--content-background); color: var(--content-foreground); }
.studies-chevron { margin-left: 0.25rem; }
.studies-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: 2.25rem; padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 500; font-family: inherit; border-radius: 9999px; border: none; cursor: pointer; transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease; outline: none; }
.studies-btn:focus-visible { box-shadow: 0 0 0 3px var(--content-ring, rgba(8, 5, 3, 0.15)); }
.studies-btn:active:not(:disabled) { opacity: 0.9; }
.studies-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.studies-btn-icon { padding: 0; width: 2.25rem; height: 2.25rem; min-width: 2.25rem; min-height: 2.25rem; }
.studies-btn-ghost { background: transparent; color: var(--content-foreground); }
.studies-btn-ghost:hover { background: var(--content-accent); color: var(--content-accent-foreground); }
.studies-btn-primary { background: var(--content-primary); color: var(--content-primary-foreground); }
.studies-btn-primary:hover { background: color-mix(in srgb, var(--content-primary) 90%, black); color: var(--content-primary-foreground); }
.studies-btn-outline { background: var(--content-background); color: var(--content-foreground); border: 1px solid var(--content-border); }
.studies-btn-outline:hover { background: var(--content-accent); color: var(--content-accent-foreground); border-color: var(--content-border); }
.studies-btn-sm { padding: 0.25rem 0.75rem; font-size: 0.8125rem; }
.studies-selection-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; padding: 1rem; margin-bottom: 1rem; background: var(--content-secondary); border-radius: 1rem; }
.studies-selection-count { font-weight: 500; }
.studies-alerts { margin-bottom: 1rem; }
.studies-alert { padding: 0.75rem 1rem; border-radius: var(--content-radius); font-size: 0.875rem; }
.studies-alert-info { background: oklch(0.92 0.08 220 / 0.5); color: oklch(0.25 0.1 250); }
.studies-alert-warning { background: oklch(0.96 0.08 85 / 0.5); color: oklch(0.35 0.1 85); }
.studies-alert-danger { background: oklch(0.95 0.08 25 / 0.5); color: oklch(0.4 0.12 25); }
.studies-table-card { background: var(--content-card); border: 1px solid var(--content-border); border-radius: 1rem; overflow: visible; position: relative; }
.studies-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; color: var(--content-muted-foreground); font-size: 0.875rem; }
.studies-spinner { width: 2.5rem; height: 2.5rem; border: 2px solid var(--content-border); border-top-color: var(--content-primary); border-radius: 50%; animation: studies-spin 0.8s linear infinite; margin-bottom: 1rem; }
.studies-spinner-sm { width: 1.25rem; height: 1.25rem; border-width: 2px; border-top-color: var(--content-primary); border-radius: 50%; animation: studies-spin 0.8s linear infinite; }
@keyframes studies-spin { to { transform: rotate(360deg); } }
.studies-empty { text-align: center; padding: 4rem 2rem; }
.studies-empty-icon { color: var(--content-muted-foreground); margin-bottom: 1rem; }
.studies-empty-title { font-size: 1.25rem; font-weight: 600; color: var(--content-foreground); margin: 0 0 0.5rem; }
.studies-empty-text { font-size: 0.875rem; color: var(--content-muted-foreground); max-width: 24rem; margin: 0 auto; }
.studies-table { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 0.875rem; table-layout: auto; font-family: var(--font-sans); }
.studies-thead-row { background: oklch(0.93 0.015 80 / 0.5); border-bottom: 1px solid var(--content-border); }
.studies-th { text-align: left; font-weight: 500; padding: 0.75rem 0.5rem; height: 2.5rem; color: var(--content-foreground); vertical-align: middle; }
.studies-tr { transition: background-color 0.15s ease; border-bottom: 1px solid var(--content-border); }
.studies-tr:last-child { border-bottom: none; }
.studies-tr:hover { background: var(--content-secondary); }
.studies-td { padding: 0.75rem 0.5rem; vertical-align: middle; }
.studies-td-muted { color: var(--content-muted-foreground); }
.studies-th-checkbox, .studies-td-checkbox { width: 3rem; text-align: center; }
.studies-th-actions, .studies-td-actions { min-width: 2.5rem; width: 2.5rem; white-space: nowrap; overflow: visible; }
.studies-checkbox { width: 1rem; height: 1rem; min-width: 1rem; min-height: 1rem; cursor: pointer; -webkit-appearance: none; appearance: none; border: 1px solid var(--content-input); border-radius: 4px; background: var(--content-card); box-shadow: var(--content-shadow-xs); vertical-align: middle; transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease; }
.studies-checkbox:hover { border-color: var(--content-primary); }
.studies-checkbox:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--content-primary); }
.studies-checkbox:checked { background: var(--content-primary); border-color: var(--content-primary); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: center; background-size: 65%; }
.studies-checkbox:checked:hover { filter: brightness(0.95); }
.studies-row-menu-wrap { position: relative; overflow: visible; }
.studies-row-menu-btn { opacity: 0.7; }
.studies-tr:hover .studies-row-menu-btn { opacity: 1; }
.studies-row-menu { position: absolute; right: 0; top: 100%; margin-top: 2px; z-index: 100; min-width: 10rem; padding: 0.25rem; background: var(--content-card); border: 1px solid var(--content-border); border-radius: var(--content-radius); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.studies-row-menu-item { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; border: none; background: transparent; cursor: pointer; border-radius: 4px; color: var(--content-foreground); transition: background-color 0.15s ease; }
.studies-row-menu-item:hover { background: var(--content-secondary); }
.studies-row-menu-item:active { background: var(--content-accent); }
.studies-row-menu-item-danger { color: var(--content-destructive); }
.studies-row-menu-item-danger:hover { background: rgba(220, 38, 38, 0.08); }
.studies-modality-menu { border-radius: var(--content-radius); border: 1px solid var(--content-border); box-shadow: 0 4px 12px rgba(0,0,0,0.12); padding: 0.25rem; }
.studies-filters-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; padding: 0.75rem 0; border-top: 1px solid var(--content-border); }
.studies-filters-label { font-size: 0.875rem; font-weight: 500; color: var(--content-foreground); }
.studies-filters-constraint { display: flex; align-items: center; gap: 0.75rem; font-size: 0.875rem; color: var(--content-muted-foreground); }
.studies-pagination { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-top: 1.5rem; }
.studies-pagination-text { font-size: 0.875rem; color: var(--content-muted-foreground); margin: 0; }
.studies-pagination-bold { font-weight: 500; color: var(--content-foreground); }
.studies-pagination-nav { display: flex; align-items: center; gap: 0.25rem; }
.studies-btn-pagination { min-width: 2rem; height: 2rem; transition: background-color 0.2s ease, color 0.2s ease; }
.studies-btn-pagination:not(.studies-btn-pagination-active):hover { background: var(--content-accent); color: var(--content-accent-foreground); }
.studies-btn-pagination:not(.studies-btn-pagination-active):active { background: var(--content-secondary); }
.studies-btn-pagination-active { background: var(--content-primary) !important; color: var(--content-primary-foreground) !important; }

/* Filter row: same style as modern project (rounded inputs, horizontal) */
.studies-filter-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; padding: 0.5rem 0; }
.studies-filter-cell { flex: 1; min-width: 0; max-width: 12rem; }
.studies-filter-cell.studies-filter-date { display: flex; align-items: center; gap: 0.5rem; max-width: 14rem; }
.studies-filter-cell.studies-filter-modality { max-width: 10rem; }
.studies-filter-icon { flex-shrink: 0; color: var(--content-muted-foreground); }
.studies-filter-input { width: 100%; min-height: 2.25rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; font-family: inherit; color: var(--content-foreground); background: var(--content-secondary); border: 1px solid transparent; border-radius: 9999px; outline: none; box-shadow: var(--content-shadow-xs); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.studies-filter-input::placeholder { color: var(--content-muted-foreground); }
.studies-filter-input:hover { border-color: var(--content-border); }
.studies-filter-input:focus { border-color: var(--content-primary); box-shadow: 0 0 0 3px rgba(8, 5, 3, 0.12); }
.studies-filter-input-wrap { flex: 1; min-width: 0; }
.studies-filter-input-wrap :deep(.dp__input) { min-height: 2.25rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; border-radius: 9999px; border: 1px solid transparent; background: var(--content-secondary); }
.studies-filter-input-wrap :deep(.dp__input:focus) { border-color: var(--content-primary); box-shadow: 0 0 0 3px rgba(8, 5, 3, 0.12); }
.studies-filter-list-icon { margin-right: 0.25rem; vertical-align: middle; }
.studies-filter-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }

/* Expanded row: labels, two-column details, copy buttons, actions */
.studies-tr { cursor: pointer; }
.studies-tr-expanded { background: var(--content-secondary) !important; }
.studies-detail-row { background: var(--content-secondary) !important; }
.studies-detail-row:hover { background: var(--content-secondary) !important; }
.studies-detail-cell { padding: 1rem 1.25rem !important; vertical-align: top !important; border-bottom: 1px solid var(--content-border); }
.studies-detail-content { display: flex; flex-direction: column; gap: 1rem; }
.studies-detail-labels { margin-bottom: 0.25rem; }
.studies-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
@media (max-width: 768px) { .studies-detail-grid { grid-template-columns: 1fr; } }
.studies-detail-col { display: flex; flex-direction: column; gap: 0.5rem; }
.studies-detail-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; flex-wrap: wrap; }
.studies-detail-label { font-weight: 500; color: var(--content-muted-foreground); min-width: 8rem; }
.studies-detail-value { color: var(--content-foreground); }
.studies-detail-value-truncate { max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.studies-detail-patient-link { font-size: 0.875rem; margin: 0.5rem 0 0; color: var(--content-muted-foreground); }
.studies-detail-patient-link a { color: var(--content-primary); text-decoration: none; }
.studies-detail-patient-link a:hover { text-decoration: underline; }
.studies-detail-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--content-border); }
.studies-detail-actions :deep(.btn-clipboard) { margin-left: 0.25rem; }
</style>