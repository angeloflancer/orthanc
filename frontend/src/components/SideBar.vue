<script>

import UploadHandler from "./UploadHandler.vue"
import JobsList from "./JobsList.vue";
import LanguagePicker from "./LanguagePicker.vue";
import { mapState, mapGetters } from "vuex"
import { orthancApiUrl, oe2ApiUrl } from "../globalConfigurations";
import api from "../orthancApi"
import SourceType from "../helpers/source-type";


export default {
    props: [],
    emits: [],
    data() {
        return {
            // selectedModality: null,
            selectedLabel: null,
            modalitiesEchoStatus: {},
            labelsStudyCount: {},
        };
    },
    computed: {
        ...mapState({
            uiOptions: state => state.configuration.uiOptions,
            userProfile: state => state.configuration.userProfile,
            system: state => state.configuration.system,
            queryableDicomModalities: state => state.configuration.queryableDicomModalities,
            queryableDicomWebServers: state => state.configuration.queryableDicomWebServers,
            studiesIds: state => state.studies.studiesIds,
            statistics: state => state.studies.statistics,
            labelFilters: state => state.studies.labelFilters,
            jobs: state => state.jobs.jobsIds,
            allLabels: state => state.labels.allLabels,
            hasCustomLogo: state => state.configuration.hasCustomLogo,
            configuration: state => state.configuration,
            studiesSourceType: state => state.studies.sourceType,
            studiesRemoteSource: state => state.studies.remoteSource,
            hasExtendedFind: state => state.configuration.hasExtendedFind,
            installedPlugins: state => state.configuration.installedPlugins
        }),
        customLogoUrl() {
            if (this.hasCustomLogo && this.configuration.customLogoUrl) {
                return this.configuration.customLogoUrl;
            } else {
                return "./customizable/custom-logo";
            }
        },
        hasQueryableDicomWebServers() {
            return this.queryableDicomWebServers.length > 0;
        },
        hasQueryableDicomModalities() {
            return this.uiOptions.EnableDicomModalities && Object.keys(this.queryableDicomModalities).length > 0;
        },
        hasAccessToSettings() {
            return this.uiOptions.EnableSettings;
        },
        hasAccessToWorklists() {
            return "orthanc-worklists" in this.installedPlugins && this.installedPlugins["orthanc-worklists"].Enabled && this.uiOptions.EnableWorklists;
        },
        hasAccessToSettingsLabelsAndPermissions() {
            return this.hasAccessToSettings && this.uiOptions.EnablePermissionsEdition;
        },
        hasJobs() {
            return this.jobs.length > 0;
        },
        hasLogout() {
            return window.keycloak !== undefined;
        },
        hasUserProfile() {
            return this.userProfile != null && this.userProfile.name;
        },
        displayedStudyCount() {
            if (this.studiesSourceType == SourceType.LOCAL_ORTHANC) {
                return this.studiesIds.length;
            } else {
                return "-";
            }
        },
        orthancApiUrl() {
            return orthancApiUrl;
        },
        currentRoutePath() {
            return this.$route.path;
        },
        hasLabels() {
            return this.allLabels && this.allLabels.length > 0;
        }
    },
    methods: {
        isSelectedModality(modality) {
            return this.studiesSourceType == SourceType.REMOTE_DICOM && this.studiesRemoteSource == modality;
        },
        isSelectedDicomWebServer(server) {
            return this.studiesSourceType == SourceType.REMOTE_DICOM_WEB && this.studiesRemoteSource == server;
        },
        isEchoRunning(modality) {
            return this.modalitiesEchoStatus[modality] == null;
        },
        isEchoSuccess(modality) {
            return this.modalitiesEchoStatus[modality] == true;
        },
        isRouteActive(path) {
            if (path === '/studies') {
                return this.currentRoutePath === '/studies' || this.currentRoutePath === '/filtered-studies';
            }
            if (path === '/') {
                return this.currentRoutePath === '/';
            }
            return this.currentRoutePath.startsWith(path);
        },
        formatModalityName(modality) {
            // Convert modality names to display format
            const displayNames = {
                'efilm_workstation': 'EFilm Workstation',
                'efilm': 'EFilm',
                // Add more mappings as needed
            };
            return displayNames[modality.toLowerCase()] || modality;
        },
        getModalityIcon(modality) {
            // Return icon class based on modality
            const icons = {
                'efilm_workstation': 'fa fa-film',
                'efilm': 'fa fa-film',
            };
            return icons[modality.toLowerCase()] || 'fa fa-desktop';
        },
        async selectLabel(label) {
            this.selectedLabel = label;
            if (this.$route.name == 'local-studies-list' || this.$route.name == 'studies-list') {
                await this.$store.dispatch('studies/updateSource', { 'source-type': SourceType.LOCAL_ORTHANC, 'remote-source': null });
                this.messageBus.emit('filter-label-changed', label);
            } else {
                this.$router.push({ path: '/filtered-studies', query: {'labels': label} });
            }
        },
        goToDashboard() {
            this.$router.push('/');
        },
        goToAllStudies() {
            // Clear label selection
            this.selectedLabel = null;
            // Clear label filters in the store
            this.$store.dispatch('studies/updateLabelFilterNoReload', { labels: [], constraint: 'All' });
            // Navigate to studies and emit event to clear filter
            this.$router.push('/studies');
            this.messageBus.emit('filter-label-changed', null);
        },
        onAllLocalStudiesClick() {
            // When clicking "All local Studies" nav, go to all studies
            this.goToAllStudies();
        },
        isSelectedLabel(label) {
            return this.labelFilters.includes(label);
        },
        logout(event) {
            event.preventDefault();
            let logoutOptions = {
                "redirectUri": window.location.href
            }
            window.keycloak.logout(logoutOptions).then((success) => {
                console.log("logout success", success);
            }).catch((error) => {
                console.error("logout failed", error);
            })
        },
        changePassword(event) {
            event.preventDefault();
            window.keycloak.login({ action: "UPDATE_PASSWORD" }).then((success) => {
                console.log("login for password change success", success);
            }).catch((error) => {
                console.error("login for password change failed", error);
            })
        },
        async loadLabelsCount() {
            // Initialize any new labels that are not yet in labelsStudyCount
            for (const label of this.allLabels) {
                if (!(label in this.labelsStudyCount)) {
                    this.labelsStudyCount[label] = null;
                }
            }
            
            if (this.hasExtendedFind) {
                if (this.uiOptions.EnableLabelsCount) {
                    for (const label of this.allLabels) {
                        // Always reload count for labels that are null
                        if (this.labelsStudyCount[label] == null) {
                            this.labelsStudyCount[label] = await api.getLabelStudyCount(label);
                        }
                    }
                }
            }
        },
        async refreshLabelCount(label) {
            // Force refresh a specific label's count
            if (this.hasExtendedFind && this.uiOptions.EnableLabelsCount) {
                this.labelsStudyCount[label] = await api.getLabelStudyCount(label);
            }
        }
    },
    watch: {
        allLabels: {
            handler(newValue, oldValue) {
                // Find new labels and load their counts
                if (newValue && oldValue) {
                    const newLabels = newValue.filter(l => !oldValue.includes(l));
                    for (const label of newLabels) {
                        this.labelsStudyCount[label] = null;
                    }
                }
                this.loadLabelsCount();
            },
            deep: true
        }
    },
    created() {
        // Listen for label updates from LabelsEditor
        this.messageBus.on('labels-updated', () => {
            // Reload all labels from API
            this.$store.dispatch('labels/refresh');
            // Force reload all label counts
            for (const label of this.allLabels) {
                this.labelsStudyCount[label] = null;
            }
            this.loadLabelsCount();
        });
    },
    mounted() {
        this.loadLabelsCount();
        this.$refs['modalities-collapsible'].addEventListener('show.bs.collapse', (e) => {
            for (const modality of Object.keys(this.queryableDicomModalities)) {
                this.modalitiesEchoStatus[modality] = null;
            }
            for (const [modality, config] of Object.entries(this.queryableDicomModalities)) {
                api.remoteModalityEcho(modality).then((response) => {
                    this.modalitiesEchoStatus[modality] = true;
                }).catch(() => {
                    this.modalitiesEchoStatus[modality] = false;
                })
            }
        });
    },
    components: { UploadHandler, JobsList, LanguagePicker },
}
</script>
<template>
    <div class="nav-side-menu">
        <div class="nav-side-content">
            <div v-if="!hasCustomLogo" class="logo-container" @click="goToDashboard" style="cursor: pointer;">
                <img class="emedx-logo" src="../assets/images/emedx-logo-white.png"/>
            </div>
            <div v-if="hasCustomLogo" class="logo-container" @click="goToDashboard" style="cursor: pointer;">
                <img class="custom-logo" :src="customLogoUrl" />
            </div>
            <div v-if="hasCustomLogo" class="logo-container">
                <p class="powered-by-emedx">
                powered by
                <img src="../assets/logo.png" />
                </p>
            </div>
            <div class="menu-list">
                <ul id="menu-content" class="menu-content">
                    <!-- Dashboard -->
                    <li class="nav-item" :class="{ 'nav-active': currentRoutePath === '/' }">
                        <router-link class="nav-link" to="/">
                            <i class="fa fa-home fa-lg nav-icon"></i>
                            <span class="nav-text">Dashboard</span>
                        </router-link>
                    </li>
                    
                    <!-- All local Studies with Labels as submenu -->
                    <li class="nav-item nav-dropdown" :class="{ 'nav-active': isRouteActive('/studies') || isRouteActive('/filtered-studies') }" 
                        @click="onAllLocalStudiesClick"
                        data-bs-toggle="collapse" data-bs-target="#studies-labels-list">
                        <div class="nav-link">
                            <i class="fa fa-x-ray fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('local_studies') }}</span>
                            <span class="nav-badge">{{ displayedStudyCount }} / {{ statistics.CountStudies }}</span>
                            <span v-if="hasLabels" class="nav-arrow"></span>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="studies-labels-list">
                        <li @click.stop="goToAllStudies" :class="{ 'active': isRouteActive('/studies') && !labelFilters.length && !selectedLabel }">
                            <i class="fa fa-list-ul sub-menu-icon"></i>
                            <span>All Studies</span>
                            <span class="study-count ms-auto">{{ statistics.CountStudies }}</span>
                        </li>
                        <li v-for="label in allLabels" :key="label"
                            v-bind:class="{ 'active': isSelectedLabel(label) }" @click.stop="selectLabel(label)">
                            <i class="fa fa-tag sub-menu-icon"></i>
                            <span>{{ label }}</span>
                            <span class="study-count ms-auto">{{ labelsStudyCount[label] != null ? labelsStudyCount[label] : '...' }}</span>
                        </li>
                    </ul>
                    
                    <li class="nav-item" :class="{ 'nav-active': isRouteActive('/word-files') }">
                        <router-link class="nav-link" to="/word-files">
                            <i class="fa fa-file-word fa-lg nav-icon"></i>
                            <span class="nav-text">All Documents</span>
                        </router-link>
                    </li>
                    <li class="nav-item" :class="{ 'nav-active': isRouteActive('/patients') }">
                        <router-link class="nav-link" to="/patients">
                            <i class="fa fa-users fa-lg nav-icon"></i>
                            <span class="nav-text">All Patients</span>
                        </router-link>
                    </li>

                    <li v-if="uiOptions.EnableUpload" class="nav-item nav-dropdown" data-bs-toggle="collapse"
                        data-bs-target="#upload-handler">
                        <div class="nav-link">
                            <i class="fa fa-file-upload fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('upload') }}</span>
                            <span class="nav-arrow"></span>
                        </div>
                    </li>
                    <div v-if="uiOptions.EnableUpload" class="collapse" id="upload-handler">
                        <UploadHandler :showStudyDetails="true"/>
                    </div>

                    <li v-if="hasQueryableDicomModalities" class="nav-item nav-dropdown" data-bs-toggle="collapse"
                        data-bs-target="#modalities-list">
                        <div class="nav-link">
                            <i class="fa fa-radiation fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('dicom_modalities') }}</span>
                            <span class="nav-arrow"></span>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="modalities-list" ref="modalities-collapsible">
                        <li v-for="modality of Object.keys(queryableDicomModalities)" :key="modality"
                            v-bind:class="{ 'active': this.isSelectedModality(modality) }" class="modality-item">
                            <router-link class="modality-link"
                                :to="{ path: '/filtered-studies', query: { 'source-type': 'dicom', 'remote-source': modality } }">
                                <i :class="getModalityIcon(modality)" class="modality-icon"></i>
                                <span>{{ formatModalityName(modality) }}</span>
                            </router-link>
                            <span v-if="this.isEchoRunning(modality)" class="ms-auto spinner-border spinner-border-sm"
                                data-bs-toggle="tooltip" title="Checking connectivity"></span>
                            <span v-else-if="this.isEchoSuccess(modality)" class="ms-auto"><i
                                    class="bi bi-check2 text-success echo-status" data-bs-toggle="tooltip"
                                    title="C-Echo succeeded"></i></span>
                            <span v-else class="ms-auto"><i class="bi bi-x-lg text-danger echo-status" data-bs-toggle="tooltip"
                                    title="C-Echo failed"></i></span>
                        </li>
                    </ul>

                    <li v-if="hasQueryableDicomWebServers" class="nav-item nav-dropdown" data-bs-toggle="collapse"
                        data-bs-target="#dicomweb-servers-list">
                        <div class="nav-link">
                            <i class="fa fa-globe fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('dicom_web_servers') }}</span>
                            <span class="nav-arrow"></span>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="dicomweb-servers-list">
                        <li v-for="server in queryableDicomWebServers" :key="server" v-bind:class="{ 'active': this.isSelectedDicomWebServer(server) }">
                            <router-link class="router-link"
                                :to="{ path: '/filtered-studies', query: { 'source-type': 'dicom-web', 'remote-source': server } }">
                                {{ server }}
                            </router-link>
                        </li>
                    </ul>
                    
                    <li v-if="hasAccessToWorklists" class="nav-item" :class="{ 'nav-active': isRouteActive('/worklists') }">
                        <router-link class="nav-link" to="/worklists">
                            <i class="fa fa-list fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('worklists.side_bar_title') }}</span>
                        </router-link>
                    </li>
                    
                    <li v-if="hasAccessToSettings" class="nav-item nav-dropdown" data-bs-toggle="collapse"
                        data-bs-target="#settings-list">
                        <div class="nav-link">
                            <i class="fa fa-cogs fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('settings.title') }}</span>
                            <span class="nav-arrow"></span>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="settings-list">
                        <li :class="{ 'active': isRouteActive('/settings') }">
                            <router-link class="router-link" to="/settings">{{ $t('settings.system_info') }}</router-link>
                        </li>
                        <li :class="{ 'active': isRouteActive('/account-settings') }">
                            <router-link class="router-link" to="/account-settings">Account Settings</router-link>
                        </li>
                    </ul>
                    
                    <li v-if="hasLogout" class="nav-item nav-dropdown" data-bs-toggle="collapse"
                        data-bs-target="#profile-list">
                        <div class="nav-link">
                            <i class="fa fa-user fa-lg nav-icon"></i>
                            <span class="nav-text" v-if="hasUserProfile">{{ userProfile.name }}</span>
                            <span class="nav-text" v-if="!hasUserProfile">{{ $t('profile') }}</span>
                            <span class="nav-arrow"></span>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="profile-list" ref="profile-collapsible">
                        <li v-if="uiOptions.EnableChangePassword">
                            <a v-bind:href="'#'" @click="changePassword($event)">
                                <i class="fa fa-solid fa-key fa-lg menu-icon"></i>{{ $t('change_password') }}
                            </a>
                        </li>
                        <li v-if="hasLogout">
                            <a v-bind:href="'#'" @click="logout($event)">
                                <i class="fa fa-solid fa-arrow-right-from-bracket fa-lg menu-icon"></i>{{ $t('logout') }}
                            </a>
                        </li>
                    </ul>
                    
                    <li v-if="hasJobs" class="nav-item">
                        <div class="nav-link">
                            <i class="fa fa-solid fa-bars-progress fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('my_jobs') }}</span>
                        </div>
                    </li>
                    <div v-if="hasJobs" class="collapse show" id="jobs-list">
                        <JobsList />
                    </div>
                </ul>
            </div>
            <div class="bottom-side-bar">
                <div class="bottom-side-bar-button">
                    <LanguagePicker />
                </div>
            </div>
        </div>
    </div>
</template>
<style scoped>
/* Base sidebar styles */
.nav-side-menu {
    font-family: verdana;
    font-size: 12px;
    font-weight: 200;
    background: linear-gradient(180deg, var(--nav-side-bg-color-gradient-start) 0%, var(--nav-side-bg-color-gradient-end) 100%);
    color: var(--nav-side-color);
}

.nav-side-content {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

.logo-container {
    padding: 10px 0;
    text-align: center;
}

.emedx-logo {
    height: 80px;
    width: 100%;
    object-fit: contain;
}

.powered-by-emedx {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 4px;
}

.powered-by-emedx > img {
    max-width: 50%;
    height: auto;
    max-height: 20px;
    margin-left: 4px;
    vertical-align: middle;
}

.custom-logo {
    padding: 4px;
    max-width: 90%;
    height: auto;
}

/* Menu list - no horizontal padding */
.menu-list {
    font-size: 14px;
}

.menu-content {
    list-style: none;
    padding: 0;
    margin: 0;
    display: block !important;
}

/* Nav item - consistent height, no horizontal padding/margin */
.nav-item {
    list-style: none;
    margin: 0;
    padding: 0;
    height: 44px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.nav-item:hover {
    background-color: var(--nav-side-selected-bg-color, rgba(255, 255, 255, 0.1));
}

/* Active nav state - left border indicator, no shadow */
.nav-item.nav-active {
    background-color: var(--nav-side-selected-bg-color, rgba(255, 255, 255, 0.15));
    border-left: 3px solid var(--nav-side-active-border-color, #4a90e2);
}

.nav-item.nav-active .nav-link {
    padding-left: 12px; /* Compensate for border */
}

/* Nav link - full width */
.nav-link {
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 0 15px;
    text-decoration: none;
    color: var(--nav-side-color, #ffffff);
}

/* Nav icon - fixed width */
.nav-icon {
    width: 24px;
    min-width: 24px;
    text-align: center;
    margin-right: 12px;
}

/* Nav text */
.nav-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Nav badge (count) */
.nav-badge {
    font-size: 11px;
    opacity: 0.8;
    margin-left: auto;
    padding-left: 10px;
    padding-right: 10px;
}

/* Nav arrow for dropdowns */
.nav-arrow::before {
    font-family: "Font Awesome 5 Free";
    font-weight: 900;
    content: "\f0d7";
    font-size: 10px;
    opacity: 0.7;
}

/* Sub-menu styles */
.sub-menu {
    list-style: none;
    padding: 0;
    margin: 0;
    background-color: var(--nav-side-sub-bg-color, rgba(0, 0, 0, 0.1));
}

.sub-menu li {
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 15px 0 40px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.sub-menu li:hover {
    background-color: var(--nav-side-selected-bg-color, rgba(255, 255, 255, 0.1));
}

.sub-menu li.active {
    background-color: var(--nav-side-selected-bg-color, rgba(255, 255, 255, 0.15));
    border-left: 3px solid var(--nav-side-active-border-color, #4a90e2);
    padding-left: 37px;
}

.sub-menu li a,
.sub-menu .router-link {
    color: var(--nav-side-color, #ffffff);
    text-decoration: none;
    flex: 1;
}

/* Sub-menu icon */
.sub-menu-icon {
    width: 16px;
    margin-right: 10px;
    text-align: center;
    font-size: 12px;
    opacity: 0.8;
}

/* Modality item styles */
.modality-item {
    display: flex;
    align-items: center;
}

.modality-link {
    display: flex;
    align-items: center;
    flex: 1;
    color: var(--nav-side-color, #ffffff);
    text-decoration: none;
}

.modality-icon {
    width: 20px;
    margin-right: 10px;
    text-align: center;
}

/* Study count in sidebar */
.study-count {
    font-size: 11px;
    opacity: 0.8;
}

/* Echo status */
.echo-status {
    font-size: 14px;
}

/* Menu icon for sub-menus */
.menu-icon {
    width: 20px;
    margin-right: 10px;
}

/* Bottom sidebar */
.bottom-side-bar {
    flex: 1;
    align-self: flex-end;
    width: 100%;
    position: relative;
    min-height: 5rem;
}

.bottom-side-bar-button {
    position: absolute;
    bottom: 1rem;
    width: 100%;
    height: 3rem;
}
</style>
