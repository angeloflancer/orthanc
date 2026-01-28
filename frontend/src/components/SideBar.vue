<script>

import UploadHandler from "./UploadHandler.vue"
import JobsList from "./JobsList.vue";
import LanguagePicker from "./LanguagePicker.vue";
import { mapState, mapGetters } from "vuex"
import { orthancApiUrl, oe2ApiUrl } from "../globalConfigurations";
import api from "../orthancApi"
import SourceType from "../helpers/source-type";
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js"
import { showAccessDeniedNotification, NotificationMessages } from "../helpers/notifications"


export default {
    props: [],
    emits: [],
    data() {
        return {
            // selectedModality: null,
            selectedLabel: null,
            modalitiesEchoStatus: {},
            labelsStudyCount: {},
            userRole: 'doctor',
            hasHospital: false,
            showLogoutConfirm: false,
            userProfileData: null,
            subscriptionInfo: null,
            hospitalMembership: null,
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
        },
        isDoctor() {
            return this.userRole === 'doctor';
        },
        isAdmin() {
            return this.userRole === 'admin';
        },
        isOwner() {
            return this.userRole === 'owner';
        },
        showDicomModalities() {
            // Hide DICOM Modalities for doctors and admins, show only for owner
            return this.isOwner && this.hasQueryableDicomModalities;
        },
        showMembersNav() {
            // Show Members nav only for admin with hospital
            return this.isAdmin && this.hasHospital;
        },
        showUsersNav() {
            // Show Users nav only for owner
            return this.isOwner;
        },
        showHospitalSettings() {
            // Show Hospital settings for admin
            return this.isAdmin;
        },
        showSystemInfoNav() {
            // "System Info" is owner-only
            return this.isOwner;
        },
        // Access control computed properties
        canAccessFeatures() {
            // Owner always has access
            if (this.isOwner) return true;
            
            // Admin needs active subscription
            if (this.isAdmin) {
                return this.subscriptionInfo && this.subscriptionInfo.isActive;
            }
            
            // Doctor needs accepted membership and active subscription
            if (this.isDoctor) {
                const hasMembership = this.hospitalMembership && this.hospitalMembership.status === 'accepted';
                const hasActiveSubscription = this.hospitalMembership && 
                    this.hospitalMembership.doctorSubscription && 
                    this.hospitalMembership.doctorSubscription.isActive;
                return hasMembership && hasActiveSubscription;
            }
            
            return false;
        },
        isHospitalExpired() {
            if (this.isOwner) return false;
            
            if (this.isAdmin) {
                return this.subscriptionInfo && !this.subscriptionInfo.isActive;
            }
            
            if (this.isDoctor) {
                return this.hospitalMembership && 
                    this.hospitalMembership.doctorSubscription && 
                    !this.hospitalMembership.doctorSubscription.isActive;
            }
            
            return false;
        },
        hasMembership() {
            if (this.isDoctor) {
                return this.hospitalMembership && this.hospitalMembership.status === 'accepted';
            }
            return true; // Admin and owner don't need membership
        }
    },
    methods: {
        isSelectedModality(modality) {
            return this.studiesSourceType == SourceType.REMOTE_DICOM && this.studiesRemoteSource == modality;
        },
        isAnyModalitySelected() {
            if (!this.hasQueryableDicomModalities) return false;
            // Check store state first
            if (Object.keys(this.queryableDicomModalities).some(modality => this.isSelectedModality(modality))) {
                return true;
            }
            // Fallback: check route query parameters (for page refresh scenarios)
            if (this.currentRoutePath === '/filtered-studies' && this.$route.query) {
                const sourceType = this.$route.query['source-type'];
                const remoteSource = this.$route.query['remote-source'];
                if (sourceType === 'dicom' && remoteSource && Object.keys(this.queryableDicomModalities).includes(remoteSource)) {
                    return true;
                }
            }
            return false;
        },
        isAnyDicomWebServerSelected() {
            if (!this.hasQueryableDicomWebServers) return false;
            // Check store state first
            if (this.queryableDicomWebServers.some(server => this.isSelectedDicomWebServer(server))) {
                return true;
            }
            // Fallback: check route query parameters (for page refresh scenarios)
            if (this.currentRoutePath === '/filtered-studies' && this.$route.query) {
                const sourceType = this.$route.query['source-type'];
                const remoteSource = this.$route.query['remote-source'];
                if (sourceType === 'dicom-web' && remoteSource && this.queryableDicomWebServers.includes(remoteSource)) {
                    return true;
                }
            }
            return false;
        },
        onModalitySelected(modality) {
            // Clear studies selection and collapse studies dropdown when modality is selected
            this.selectedLabel = null;
            this.$store.dispatch('studies/updateLabelFilterNoReload', { labels: [], constraint: 'All' });
            this.collapseStudiesDropdown();
            // Collapse all other dropdowns except modalities-list (keep parent open)
            this.collapseAllDropdowns('modalities-list');
        },
        onDicomWebServerSelected(server) {
            // Clear studies selection and collapse studies dropdown when DICOM Web server is selected
            this.selectedLabel = null;
            this.$store.dispatch('studies/updateLabelFilterNoReload', { labels: [], constraint: 'All' });
            this.collapseStudiesDropdown();
            // Collapse all other dropdowns except dicomweb-servers-list (keep parent open)
            this.collapseAllDropdowns('dicomweb-servers-list');
        },
        onLabelSelected(label) {
            // Collapse all other dropdowns except studies-labels-list (keep parent open)
            this.collapseAllDropdowns('studies-labels-list');
        },
        onSettingsSubmenuSelected() {
            // Collapse all other dropdowns except settings-list (keep parent open)
            this.collapseAllDropdowns('settings-list');
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
                // Only active for local studies, not for remote DICOM modalities or DICOM Web servers
                if (this.currentRoutePath === '/studies') {
                    return true;
                }
                if (this.currentRoutePath === '/filtered-studies') {
                    // Check if it's actually for local studies (no source-type or source-type is not dicom/dicom-web)
                    const query = this.$route.query;
                    if (!query['source-type'] || (query['source-type'] !== 'dicom' && query['source-type'] !== 'dicom-web')) {
                        return true;
                    }
                }
                return false;
            }
            if (path === '/') {
                return this.currentRoutePath === '/';
            }
            // For other paths, use exact match or startsWith, but be more specific
            if (path === '/word-files') {
                return this.currentRoutePath === '/word-files' || this.currentRoutePath.startsWith('/word-files/');
            }
            if (path === '/patients') {
                return this.currentRoutePath === '/patients' || this.currentRoutePath.startsWith('/patients/');
            }
            if (path === '/worklists') {
                return this.currentRoutePath === '/worklists' || this.currentRoutePath.startsWith('/worklists/');
            }
            if (path === '/settings') {
                return this.currentRoutePath === '/settings' || this.currentRoutePath.startsWith('/settings/');
            }
            if (path === '/account-settings') {
                return this.currentRoutePath === '/account-settings';
            }
            if (path === '/hospital-settings') {
                return this.currentRoutePath === '/hospital-settings';
            }
            if (path === '/members') {
                return this.currentRoutePath === '/members' || this.currentRoutePath.startsWith('/members/');
            }
            if (path === '/users') {
                return this.currentRoutePath === '/users' || this.currentRoutePath.startsWith('/users/');
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
        async goToAllStudies() {
            // Clear label selection
            this.selectedLabel = null;
            // Clear label filters in the store
            await this.$store.dispatch('studies/updateLabelFilterNoReload', { labels: [], constraint: 'All' });
            // Navigate to studies - this will trigger the route watcher in StudyList which calls updateFilterFromRoute
            if (this.$route.path !== '/studies') {
                await this.$router.push('/studies');
            } else {
                // If already on /studies, manually trigger the filter update to reload data
                this.$nextTick(() => {
                    this.messageBus.emit('filter-label-changed', null);
                });
            }
        },
        onAllLocalStudiesClick() {
            // When clicking "All local Studies" nav, go to all studies and load data
            this.goToAllStudies();
        },
        isSelectedLabel(label) {
            return this.labelFilters.includes(label);
        },
        collapseStudiesDropdown() {
            // Collapse the "All local Studies" dropdown using Bootstrap collapse API
            this.$nextTick(() => {
                const studiesDropdown = document.getElementById('studies-labels-list');
                if (studiesDropdown && studiesDropdown.classList.contains('show')) {
                    const bsCollapse = bootstrap.Collapse.getInstance(studiesDropdown);
                    if (bsCollapse) {
                        bsCollapse.hide();
                    } else {
                        // If no instance exists, create one and hide
                        const newCollapse = new bootstrap.Collapse(studiesDropdown, { toggle: false });
                        newCollapse.hide();
                    }
                }
            });
        },
        collapseAllDropdowns(exceptId = null) {
            // Collapse all dropdowns except the one that should be active
            const dropdowns = [
                'studies-labels-list',
                'modalities-list',
                'dicomweb-servers-list',
                'settings-list',
                'upload-handler',
                'profile-list'
            ];
            this.$nextTick(() => {
                dropdowns.forEach(id => {
                    if (id === exceptId) return;
                    const element = document.getElementById(id);
                    if (element && element.classList.contains('show')) {
                        const bsCollapse = bootstrap.Collapse.getInstance(element);
                        if (bsCollapse) {
                            bsCollapse.hide();
                        } else {
                            // If no instance exists, create one and hide
                            const newCollapse = new bootstrap.Collapse(element, { toggle: false });
                            newCollapse.hide();
                        }
                    }
                });
            });
        },
        logout(event) {
            event.preventDefault();
            this.showLogoutConfirm = true;
        },
        confirmLogout() {
            this.showLogoutConfirm = false;
            
            // Show success notification
            if (this.messageBus) {
                this.messageBus.emit('show-success-toast', this.$t('logout_success_message') || 'Logged out successfully!');
            }
            
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
        },
        async loadUserRole() {
            try {
                const token = localStorage.getItem('auth-token');
                if (!token) return;
                
                const response = await fetch(`${this.orthancApiUrl}api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.user) {
                        this.userRole = data.user.role || 'doctor';
                        this.userProfileData = data.user;
                        
                        // Check if admin has a hospital
                        if (data.user.role === 'admin' && data.user.hospital) {
                            this.hasHospital = true;
                        }
                        
                        // Store subscription info for admin
                        if (data.user.role === 'admin' && data.user.subscription) {
                            this.subscriptionInfo = data.user.subscription;
                        }
                        
                        // Store membership info for doctor
                        if (data.user.role === 'doctor') {
                            this.hospitalMembership = {
                                ...data.user.hospitalMembership,
                                doctorSubscription: data.user.doctorSubscription
                            };
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading user role:', error);
            }
        },
        handleLogout() {
            this.showLogoutConfirm = true;
        },
        confirmHandleLogout() {
            this.showLogoutConfirm = false;
            
            // Show success notification
            if (this.messageBus) {
                this.messageBus.emit('show-success-toast', this.$t('logout_success_message') || 'Logged out successfully!');
            }
            
            localStorage.removeItem('auth-token');
            localStorage.removeItem('user');
            
            // Small delay to show notification before redirect
            setTimeout(() => {
                this.$router.push('/login');
            }, 100);
        },
        handleDisabledNavClick(feature) {
            let message = NotificationMessages.ACCESS_DENIED;
            
            if (this.isDoctor) {
                if (!this.hasMembership) {
                    message = NotificationMessages.DOCTOR_NO_MEMBERSHIP;
                } else if (this.isHospitalExpired) {
                    message = NotificationMessages.DOCTOR_HOSPITAL_SUSPENDED;
                }
            } else if (this.isAdmin) {
                if (!this.subscriptionInfo) {
                    message = NotificationMessages.ADMIN_NO_SUBSCRIPTION;
                } else if (this.isHospitalExpired) {
                    message = NotificationMessages.ADMIN_EXPIRED_SUBSCRIPTION;
                }
            }
            
            if (this.messageBus) {
                this.messageBus.emit('show-error-toast', message);
            }
        },
        handleNavClick(event, feature) {
            if (!this.canAccessFeatures) {
                event.preventDefault();
                event.stopPropagation();
                this.handleDisabledNavClick(feature);
                return false;
            }
            return true;
        },
        handleStudiesNavClick() {
            this.onAllLocalStudiesClick();
            this.collapseAllDropdowns('studies-labels-list');
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
        },
        // Clear selected label and label filters when navigating away from local studies routes
        '$route'(to, from) {
            // Check if navigating to a remote DICOM modality or DICOM Web server
            const isRemoteDicom = to.query && (to.query['source-type'] === 'dicom' || to.query['source-type'] === 'dicom-web');
            
            // Determine which dropdown should remain open based on the route
            let keepOpenDropdown = null;
            if (to.path.startsWith('/studies') || (to.path.startsWith('/filtered-studies') && !isRemoteDicom)) {
                // Local studies route - keep studies dropdown open
                keepOpenDropdown = 'studies-labels-list';
            } else if (isRemoteDicom && to.query['source-type'] === 'dicom') {
                // Remote DICOM modality - keep modalities dropdown open
                keepOpenDropdown = 'modalities-list';
            } else if (isRemoteDicom && to.query['source-type'] === 'dicom-web') {
                // DICOM Web server - keep dicomweb-servers dropdown open
                keepOpenDropdown = 'dicomweb-servers-list';
            } else if (to.path.startsWith('/settings') || to.path.startsWith('/account-settings')) {
                // Settings route - keep settings dropdown open
                keepOpenDropdown = 'settings-list';
            }
            
            // Update store source type based on route
            if (to.path.startsWith('/filtered-studies') && to.query) {
                // Update store when navigating to filtered-studies with source-type
                if (to.query['source-type'] === 'dicom') {
                    this.$store.dispatch('studies/updateSource', { 
                        'source-type': SourceType.REMOTE_DICOM, 
                        'remote-source': to.query['remote-source'] 
                    });
                } else if (to.query['source-type'] === 'dicom-web') {
                    this.$store.dispatch('studies/updateSource', { 
                        'source-type': SourceType.REMOTE_DICOM_WEB, 
                        'remote-source': to.query['remote-source'] 
                    });
                } else {
                    // Local studies - clear remote source
                    this.$store.dispatch('studies/updateSource', { 
                        'source-type': SourceType.LOCAL_ORTHANC, 
                        'remote-source': null 
                    });
                }
            } else if (to.path.startsWith('/studies')) {
                // Local studies route - ensure source type is LOCAL_ORTHANC
                this.$store.dispatch('studies/updateSource', { 
                    'source-type': SourceType.LOCAL_ORTHANC, 
                    'remote-source': null 
                });
            } else {
                // Navigating away from studies routes - clear source type to LOCAL_ORTHANC
                this.$store.dispatch('studies/updateSource', { 
                    'source-type': SourceType.LOCAL_ORTHANC, 
                    'remote-source': null 
                });
            }
            
            // If navigating to remote DICOM or away from studies routes, clear studies selection
            if (isRemoteDicom || (!to.path.startsWith('/studies') && !to.path.startsWith('/filtered-studies'))) {
                // Clear label selection
                this.selectedLabel = null;
                // Clear label filters in the store
                this.$store.dispatch('studies/updateLabelFilterNoReload', { labels: [], constraint: 'All' });
                // Collapse "All local Studies" dropdown (unless it should stay open)
                if (keepOpenDropdown !== 'studies-labels-list') {
                    this.collapseStudiesDropdown();
                }
            }
            
            // Collapse all dropdowns except the one that should remain open
            if (to.path.startsWith('/word-files') || to.path.startsWith('/patients') || to.path === '/' || to.path.startsWith('/worklists')) {
                // Main nav routes - collapse all dropdowns
                this.collapseAllDropdowns();
            } else if (keepOpenDropdown) {
                // Keep the appropriate dropdown open, collapse others
                this.collapseAllDropdowns(keepOpenDropdown);
            }
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
        this.loadUserRole();
        if (this.$refs['modalities-collapsible']) {
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
        }
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
                    <li class="nav-item" :class="{ 'nav-active': currentRoutePath === '/' }" @click="collapseAllDropdowns()">
                        <router-link class="nav-link" to="/">
                            <i class="fa fa-home fa-lg nav-icon"></i>
                            <span class="nav-text">Dashboard</span>
                        </router-link>
                    </li>
                    
                    <!-- All local Studies with Labels as submenu -->
                    <li class="nav-item nav-dropdown" 
                        :class="{ 
                            'nav-active': isRouteActive('/studies'),
                            'nav-disabled': !canAccessFeatures
                        }" 
                        @click="!canAccessFeatures ? handleDisabledNavClick('studies') : handleStudiesNavClick()"
                        :data-bs-toggle="canAccessFeatures ? 'collapse' : null"
                        :data-bs-target="canAccessFeatures ? '#studies-labels-list' : null">
                        <div class="nav-link">
                            <i class="fa fa-x-ray fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('local_studies') }}</span>
                            <span v-if="hasLabels" class="nav-arrow"></span>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="studies-labels-list">
                        <li @click.stop="goToAllStudies(); onLabelSelected(null)" :class="{ 'active': isRouteActive('/studies') && !labelFilters.length && !selectedLabel }">
                            <i class="fa fa-list-ul sub-menu-icon"></i>
                            <span>All Studies</span>
                            <span class="study-count ms-auto">{{ displayedStudyCount }}</span>
                        </li>
                        <li v-for="label in allLabels" :key="label"
                            v-bind:class="{ 'active': isSelectedLabel(label) }" @click.stop="selectLabel(label)">
                            <i class="fa fa-tag sub-menu-icon"></i>
                            <span>{{ label }}</span>
                            <span class="study-count ms-auto">{{ labelsStudyCount[label] != null ? labelsStudyCount[label] : '...' }}</span>
                        </li>
                    </ul>
                    
                    <li class="nav-item" 
                        :class="{ 
                            'nav-active': isRouteActive('/word-files'),
                            'nav-disabled': !canAccessFeatures
                        }" 
                        @click="!canAccessFeatures ? handleDisabledNavClick('documents') : collapseAllDropdowns()">
                        <router-link 
                            v-if="canAccessFeatures"
                            class="nav-link" 
                            to="/word-files">
                            <i class="fa fa-file-word fa-lg nav-icon"></i>
                            <span class="nav-text">All Documents</span>
                        </router-link>
                        <div v-else class="nav-link" @click.prevent="handleDisabledNavClick('documents')">
                            <i class="fa fa-file-word fa-lg nav-icon"></i>
                            <span class="nav-text">All Documents</span>
                        </div>
                    </li>
                    <li class="nav-item" 
                        :class="{ 
                            'nav-active': isRouteActive('/patients'),
                            'nav-disabled': !canAccessFeatures
                        }" 
                        @click="!canAccessFeatures ? handleDisabledNavClick('patients') : collapseAllDropdowns()">
                        <router-link 
                            v-if="canAccessFeatures"
                            class="nav-link" 
                            to="/patients">
                            <i class="fa fa-users fa-lg nav-icon"></i>
                            <span class="nav-text">All Patients</span>
                        </router-link>
                        <div v-else class="nav-link" @click.prevent="handleDisabledNavClick('patients')">
                            <i class="fa fa-users fa-lg nav-icon"></i>
                            <span class="nav-text">All Patients</span>
                        </div>
                    </li>

                    <li v-if="uiOptions.EnableUpload" 
                        class="nav-item nav-dropdown" 
                        :class="{ 'nav-disabled': !canAccessFeatures }"
                        :data-bs-toggle="canAccessFeatures ? 'collapse' : null"
                        :data-bs-target="canAccessFeatures ? '#upload-handler' : null"
                        @click="!canAccessFeatures ? handleDisabledNavClick('upload') : null">
                        <div class="nav-link">
                            <i class="fa fa-file-upload fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('upload') }}</span>
                            <span class="nav-arrow"></span>
                        </div>
                    </li>
                    <div v-if="uiOptions.EnableUpload" class="collapse" id="upload-handler">
                        <UploadHandler :showStudyDetails="true"/>
                    </div>

                    <!-- Users Management (Owner only) -->
                    <li v-if="showUsersNav" class="nav-item" :class="{ 'nav-active': isRouteActive('/users') }" @click="collapseAllDropdowns()">
                        <router-link class="nav-link" to="/users">
                            <i class="fa fa-users-cog fa-lg nav-icon"></i>
                            <span class="nav-text">User Management</span>
                        </router-link>
                    </li>

                    <!-- Members Management (Admin with hospital only) -->
                    <li v-if="showMembersNav" 
                        class="nav-item" 
                        :class="{ 
                            'nav-active': isRouteActive('/members'),
                            'nav-disabled': isHospitalExpired
                        }" 
                        @click="isHospitalExpired ? handleDisabledNavClick('members') : collapseAllDropdowns()">
                        <router-link 
                            v-if="!isHospitalExpired"
                            class="nav-link" 
                            to="/members">
                            <i class="fa fa-user-friends fa-lg nav-icon"></i>
                            <span class="nav-text">Hospital Members</span>
                        </router-link>
                        <div v-else class="nav-link" @click.prevent="handleDisabledNavClick('members')">
                            <i class="fa fa-user-friends fa-lg nav-icon"></i>
                            <span class="nav-text">Hospital Members</span>
                        </div>
                    </li>

                    <li v-if="showDicomModalities" class="nav-item nav-dropdown" 
                        :class="{ 'nav-active': isAnyModalitySelected() }"
                        @click="collapseAllDropdowns('modalities-list')"
                        data-bs-toggle="collapse"
                        data-bs-target="#modalities-list">
                        <div class="nav-link">
                            <i class="fa fa-radiation fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('dicom_modalities') }}</span>
                            <span class="nav-arrow"></span>
                        </div>
                    </li>
                    <ul v-if="showDicomModalities" class="sub-menu collapse" id="modalities-list" ref="modalities-collapsible">
                        <li v-for="modality of Object.keys(queryableDicomModalities)" :key="modality"
                            v-bind:class="{ 'active': this.isSelectedModality(modality) }" class="modality-item"
                            @click="onModalitySelected(modality)">
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

                    <li v-if="hasQueryableDicomWebServers" class="nav-item nav-dropdown" 
                        :class="{ 'nav-active': isAnyDicomWebServerSelected() }"
                        @click="collapseAllDropdowns('dicomweb-servers-list')"
                        data-bs-toggle="collapse"
                        data-bs-target="#dicomweb-servers-list">
                        <div class="nav-link">
                            <i class="fa fa-globe fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('dicom_web_servers') }}</span>
                            <span class="nav-arrow"></span>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="dicomweb-servers-list">
                        <li v-for="server in queryableDicomWebServers" :key="server" 
                            v-bind:class="{ 'active': this.isSelectedDicomWebServer(server) }"
                            @click="onDicomWebServerSelected(server)">
                            <router-link class="router-link"
                                :to="{ path: '/filtered-studies', query: { 'source-type': 'dicom-web', 'remote-source': server } }">
                                {{ server }}
                            </router-link>
                        </li>
                    </ul>
                    
                    <li v-if="hasAccessToWorklists" class="nav-item" :class="{ 'nav-active': isRouteActive('/worklists') }" @click="collapseAllDropdowns()">
                        <router-link class="nav-link" to="/worklists">
                            <i class="fa fa-list fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('worklists.side_bar_title') }}</span>
                        </router-link>
                    </li>
                    
                    <li v-if="hasAccessToSettings" class="nav-item nav-dropdown" 
                        :class="{ 'nav-active': isRouteActive('/settings') || isRouteActive('/account-settings') }"
                        @click="collapseAllDropdowns('settings-list')"
                        data-bs-toggle="collapse"
                        data-bs-target="#settings-list">
                        <div class="nav-link">
                            <i class="fa fa-cogs fa-lg nav-icon"></i>
                            <span class="nav-text">{{ $t('settings.title') }}</span>
                            <span class="nav-arrow"></span>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="settings-list">
                        <li v-if="showSystemInfoNav" :class="{ 'active': isRouteActive('/settings') }" @click="onSettingsSubmenuSelected()">
                            <router-link class="router-link" to="/settings">{{ $t('settings.system_info') }}</router-link>
                        </li>
                        <li :class="{ 'active': isRouteActive('/account-settings') }" @click="onSettingsSubmenuSelected()">
                            <router-link class="router-link" to="/account-settings">Account Settings</router-link>
                        </li>
                        <li v-if="showHospitalSettings" :class="{ 'active': isRouteActive('/hospital-settings') }" @click="onSettingsSubmenuSelected()">
                            <router-link class="router-link" to="/hospital-settings">Hospital Settings</router-link>
                        </li>
                    </ul>
                    
                    <!-- Logout button (for auth-token based login) -->
                    <li v-if="!hasLogout" class="nav-item" @click="handleLogout">
                        <div class="nav-link">
                            <i class="fa fa-sign-out-alt fa-lg nav-icon"></i>
                            <span class="nav-text">Logout</span>
                        </div>
                    </li>
                    
                    <!-- Logout Confirmation Dialog -->
                    <div v-if="showLogoutConfirm" class="logout-confirm-overlay" @click.self="showLogoutConfirm = false">
                        <div class="logout-confirm-dialog">
                            <div class="logout-confirm-content">
                                <div class="logout-confirm-header">
                                    <h5 class="logout-confirm-title">{{ $t('logout') }}</h5>
                                </div>
                                <div class="logout-confirm-body">
                                    <p>{{ $t('logout_confirm_message') || 'Are you sure you want to log out?' }}</p>
                                </div>
                                <div class="logout-confirm-footer">
                                    <button type="button" class="btn btn-secondary" @click="showLogoutConfirm = false">
                                        {{ $t('cancel') || 'Cancel' }}
                                    </button>
                                    <button type="button" class="btn btn-primary" @click="hasLogout ? confirmLogout() : confirmHandleLogout()">
                                        {{ $t('logout') }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
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

/* Disabled nav item */
.nav-item.nav-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: auto;
}

.nav-item.nav-disabled .nav-link {
    cursor: not-allowed;
    pointer-events: auto;
}

.nav-item.nav-disabled:hover {
    opacity: 0.6;
    background-color: rgba(255, 255, 255, 0.05);
}

.nav-item.nav-disabled .nav-icon,
.nav-item.nav-disabled .nav-text {
    opacity: 0.6;
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

/* Logout Confirmation Dialog */
.logout-confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.2s ease;
}

.logout-confirm-dialog {
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    max-width: 400px;
    width: 90%;
    animation: slideUp 0.3s ease;
}

.logout-confirm-content {
    display: flex;
    flex-direction: column;
}

.logout-confirm-header {
    padding: 20px 24px 16px;
    border-bottom: 1px solid #e5e7eb;
}

.logout-confirm-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
}

.logout-confirm-body {
    padding: 20px 24px;
}

.logout-confirm-body p {
    margin: 0;
    font-size: 14px;
    color: #6b7280;
    line-height: 1.5;
}

.logout-confirm-footer {
    padding: 16px 24px 20px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    border-top: 1px solid #e5e7eb;
}

.logout-confirm-footer .btn {
    padding: 8px 20px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 6px;
    transition: all 0.2s ease;
    border: none;
    cursor: pointer;
}

.logout-confirm-footer .btn-secondary {
    background-color: #f3f4f6;
    color: #374151;
}

.logout-confirm-footer .btn-secondary:hover {
    background-color: #e5e7eb;
}

.logout-confirm-footer .btn-primary {
    background-color: #3b82f6;
    color: white;
}

.logout-confirm-footer .btn-primary:hover {
    background-color: #2563eb;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes slideUp {
    from {
        transform: translateY(20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

/* Dark mode support */
[data-bs-theme="dark"] .logout-confirm-dialog {
    background: #1f2937;
}

[data-bs-theme="dark"] .logout-confirm-header {
    border-bottom-color: #374151;
}

[data-bs-theme="dark"] .logout-confirm-title {
    color: #f9fafb;
}

[data-bs-theme="dark"] .logout-confirm-body p {
    color: #d1d5db;
}

[data-bs-theme="dark"] .logout-confirm-footer {
    border-top-color: #374151;
}

[data-bs-theme="dark"] .logout-confirm-footer .btn-secondary {
    background-color: #374151;
    color: #f9fafb;
}

[data-bs-theme="dark"] .logout-confirm-footer .btn-secondary:hover {
    background-color: #4b5563;
}
</style>
