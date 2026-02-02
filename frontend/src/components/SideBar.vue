<script>

import UploadHandler from "./UploadHandler.vue"
import JobsList from "./JobsList.vue";
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
        documentCountFormatted() {
            if (this.statistics && typeof this.statistics.CountDocuments === 'number') {
                return this.statistics.CountDocuments.toLocaleString();
            }
            if (this.statistics && typeof this.statistics.TotalDiskSize !== 'undefined') {
                return "—";
            }
            return "—";
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
    components: { UploadHandler, JobsList },
}
</script>
<template>
    <aside class="sidebar-modern">
        <div class="sidebar-inner">
            <!-- Logo -->
            <div class="sidebar-header" @click="goToDashboard">
                <span class="sidebar-logo-text">EMEDX</span>
            </div>

            <!-- Nav -->
            <nav class="sidebar-nav">
                <ul id="menu-content" class="menu-content">
                    <!-- Dashboard -->
                    <li class="nav-item">
                        <router-link class="nav-link" to="/" :class="{ 'active': currentRoutePath === '/' }" @click.native="collapseAllDropdowns()">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            <span class="nav-text">Dashboard</span>
                        </router-link>
                    </li>

                    <!-- All DICOM Studies -->
                    <li class="nav-item nav-dropdown" :class="{ 'nav-disabled': !canAccessFeatures }">
                        <div class="nav-link nav-toggle" :class="{ 'active': isRouteActive('/studies') }"
                            @click="canAccessFeatures ? handleStudiesNavClick() : handleDisabledNavClick('studies')"
                            :data-bs-toggle="canAccessFeatures ? 'collapse' : null"
                            :data-bs-target="canAccessFeatures ? '#studies-labels-list' : null">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2v6h6"/><path d="M12 12H2V4a2 2 0 0 1 2-2h6"/><path d="M14 2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"/></svg>
                            <span class="nav-text">{{ $t('local_studies') }}</span>
                            <svg v-if="hasLabels" class="nav-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="studies-labels-list">
                        <li @click.stop="goToAllStudies(); onLabelSelected(null)" :class="{ 'active': isRouteActive('/studies') && !labelFilters.length && !selectedLabel }" class="sub-item">
                            <svg class="sub-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                            <span>All Studies</span>
                            <span class="nav-badge">{{ displayedStudyCount }}</span>
                        </li>
                        <li v-for="label in allLabels" :key="label" :class="{ 'active': isSelectedLabel(label) }" class="sub-item" @click.stop="selectLabel(label)">
                            <svg class="sub-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>
                            <span>{{ label }}</span>
                            <span class="nav-badge">{{ labelsStudyCount[label] != null ? labelsStudyCount[label] : '...' }}</span>
                        </li>
                    </ul>

                    <!-- All Documents -->
                    <li class="nav-item" :class="{ 'nav-disabled': !canAccessFeatures }">
                        <router-link v-if="canAccessFeatures" class="nav-link" to="/word-files" :class="{ 'active': isRouteActive('/word-files') }" @click.native="collapseAllDropdowns()">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 9.5 8 15h4l2-5.5"/><circle cx="12" cy="12" r="3"/></svg>
                            <span class="nav-text">All Documents</span>
                        </router-link>
                        <div v-else class="nav-link" :class="{ 'active': false }" @click.prevent="handleDisabledNavClick('documents')">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 9.5 8 15h4l2-5.5"/><circle cx="12" cy="12" r="3"/></svg>
                            <span class="nav-text">All Documents</span>
                        </div>
                    </li>

                    <!-- All Patients -->
                    <li class="nav-item" :class="{ 'nav-disabled': !canAccessFeatures }">
                        <router-link v-if="canAccessFeatures" class="nav-link" to="/patients" :class="{ 'active': isRouteActive('/patients') }" @click.native="collapseAllDropdowns()">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            <span class="nav-text">All Patients</span>
                        </router-link>
                        <div v-else class="nav-link" @click.prevent="handleDisabledNavClick('patients')">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                            <span class="nav-text">All Patients</span>
                        </div>
                    </li>

                    <!-- Upload -->
                    <li v-if="uiOptions.EnableUpload" class="nav-item nav-dropdown" :class="{ 'nav-disabled': !canAccessFeatures }"
                        :data-bs-toggle="canAccessFeatures ? 'collapse' : null"
                        :data-bs-target="canAccessFeatures ? '#upload-handler' : null"
                        @click="!canAccessFeatures ? handleDisabledNavClick('upload') : null">
                        <div class="nav-link nav-toggle">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                            <span class="nav-text">{{ $t('upload') }}</span>
                            <svg class="nav-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
                        </div>
                    </li>
                    <div v-if="uiOptions.EnableUpload" class="collapse upload-panel" id="upload-handler">
                        <UploadHandler :showStudyDetails="true"/>
                    </div>

                    <!-- User Management -->
                    <li v-if="showUsersNav" class="nav-item">
                        <router-link class="nav-link" to="/users" :class="{ 'active': isRouteActive('/users') }" @click.native="collapseAllDropdowns()">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="22" cy="11" r="2"/></svg>
                            <span class="nav-text">User Management</span>
                        </router-link>
                    </li>
                    <li v-if="showUsersNav" class="nav-item">
                        <router-link class="nav-link" to="/hospitals" :class="{ 'active': isRouteActive('/hospitals') }" @click.native="collapseAllDropdowns()">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
                            <span class="nav-text">Hospital Management</span>
                        </router-link>
                    </li>
                    <li v-if="showMembersNav" class="nav-item" :class="{ 'nav-disabled': isHospitalExpired }">
                        <router-link v-if="!isHospitalExpired" class="nav-link" to="/members" :class="{ 'active': isRouteActive('/members') }" @click.native="collapseAllDropdowns()">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            <span class="nav-text">Hospital Members</span>
                        </router-link>
                        <div v-else class="nav-link" @click.prevent="handleDisabledNavClick('members')">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                            <span class="nav-text">Hospital Members</span>
                        </div>
                    </li>

                    <!-- DICOM Modalities -->
                    <li v-if="showDicomModalities" class="nav-item nav-dropdown" :class="{ 'active': isAnyModalitySelected() }"
                        data-bs-toggle="collapse" data-bs-target="#modalities-list" @click="collapseAllDropdowns('modalities-list')">
                        <div class="nav-link nav-toggle">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
                            <span class="nav-text">{{ $t('dicom_modalities') }}</span>
                            <svg class="nav-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </li>
                    <ul v-if="showDicomModalities" class="sub-menu collapse" id="modalities-list" ref="modalities-collapsible">
                        <li v-for="modality of Object.keys(queryableDicomModalities)" :key="modality" :class="{ 'active': isSelectedModality(modality) }" class="modality-item sub-item" @click="onModalitySelected(modality)">
                            <router-link class="sub-link" :to="{ path: '/filtered-studies', query: { 'source-type': 'dicom', 'remote-source': modality } }">
                                <svg class="sub-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
                                {{ formatModalityName(modality) }}
                            </router-link>
                            <span v-if="isEchoRunning(modality)" class="spinner-border spinner-border-sm" title="Checking connectivity"></span>
                            <span v-else-if="isEchoSuccess(modality)" class="echo-ok" title="C-Echo succeeded">✓</span>
                            <span v-else class="echo-fail" title="C-Echo failed">✕</span>
                        </li>
                    </ul>

                    <!-- DICOM Web Servers -->
                    <li v-if="hasQueryableDicomWebServers" class="nav-item nav-dropdown"
                        data-bs-toggle="collapse" data-bs-target="#dicomweb-servers-list" @click="collapseAllDropdowns('dicomweb-servers-list')">
                        <div class="nav-link nav-toggle" :class="{ 'active': isAnyDicomWebServerSelected() }">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            <span class="nav-text">{{ $t('dicom_web_servers') }}</span>
                            <svg class="nav-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="dicomweb-servers-list">
                        <li v-for="server in queryableDicomWebServers" :key="server" :class="{ 'active': isSelectedDicomWebServer(server) }" class="sub-item" @click="onDicomWebServerSelected(server)">
                            <router-link class="sub-link" :to="{ path: '/filtered-studies', query: { 'source-type': 'dicom-web', 'remote-source': server } }">{{ server }}</router-link>
                        </li>
                    </ul>

                    <!-- Worklists -->
                    <li v-if="hasAccessToWorklists" class="nav-item">
                        <router-link class="nav-link" to="/worklists" :class="{ 'active': isRouteActive('/worklists') }" @click.native="collapseAllDropdowns()">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                            <span class="nav-text">{{ $t('worklists.side_bar_title') }}</span>
                        </router-link>
                    </li>

                    <!-- Settings -->
                    <li v-if="hasAccessToSettings" class="nav-item nav-dropdown"
                        data-bs-toggle="collapse" data-bs-target="#settings-list" @click="collapseAllDropdowns('settings-list')">
                        <div class="nav-link nav-toggle" :class="{ 'active': isRouteActive('/settings') || isRouteActive('/account-settings') }">
                            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                            <span class="nav-text">{{ $t('settings.title') }}</span>
                            <svg class="nav-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                    </li>
                    <ul class="sub-menu collapse" id="settings-list">
                        <li v-if="showSystemInfoNav" :class="{ 'active': isRouteActive('/settings') }" class="sub-item" @click="onSettingsSubmenuSelected()">
                            <router-link class="sub-link" to="/settings">{{ $t('settings.system_info') }}</router-link>
                        </li>
                        <li :class="{ 'active': isRouteActive('/account-settings') }" class="sub-item" @click="onSettingsSubmenuSelected()">
                            <router-link class="sub-link" to="/account-settings">Account Settings</router-link>
                        </li>
                        <li v-if="showHospitalSettings" :class="{ 'active': isRouteActive('/hospital-settings') }" class="sub-item" @click="onSettingsSubmenuSelected()">
                            <router-link class="sub-link" to="/hospital-settings">Hospital Settings</router-link>
                        </li>
                    </ul>
                </ul>
            </nav>

            <!-- Summary cards -->
            <div class="sidebar-cards">
                <div class="sidebar-card">
                    <svg class="sidebar-card-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                    <p class="sidebar-card-value">{{ documentCountFormatted }}</p>
                    <p class="sidebar-card-label">Documents</p>
                </div>
                <div class="sidebar-card">
                    <svg class="sidebar-card-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    <p class="sidebar-card-value">{{ displayedStudyCount }}</p>
                    <p class="sidebar-card-label">Studies</p>
                </div>
            </div>

            <!-- Logout / Profile -->
            <div class="sidebar-footer">
                <div v-if="!hasLogout" class="nav-link logout-link" @click="handleLogout">
                    <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                    <span class="nav-text">Logout</span>
                </div>
                <template v-else>
                    <div class="nav-link nav-toggle logout-link" data-bs-toggle="collapse" data-bs-target="#profile-list">
                        <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span class="nav-text">{{ hasUserProfile ? userProfile.name : $t('profile') }}</span>
                        <svg class="nav-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                    <ul class="sub-menu collapse" id="profile-list" ref="profile-collapsible">
                        <li v-if="uiOptions.EnableChangePassword" class="sub-item"><a href="#" @click.prevent="changePassword($event)">{{ $t('change_password') }}</a></li>
                        <li v-if="hasLogout" class="sub-item"><a href="#" @click.prevent="logout($event)">{{ $t('logout') }}</a></li>
                    </ul>
                </template>
            </div>
        </div>

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
                        <button type="button" class="btn btn-secondary" @click="showLogoutConfirm = false">{{ $t('cancel') || 'Cancel' }}</button>
                        <button type="button" class="btn btn-primary" @click="hasLogout ? confirmLogout() : confirmHandleLogout()">{{ $t('logout') }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Jobs (if any) -->
        <div v-if="hasJobs" class="collapse show" id="jobs-list"><JobsList /></div>
    </aside>
</template>
<style scoped>
/* Disable nav expand/collapse animation */
.sidebar-modern .collapse,
.sidebar-modern .collapsing {
  transition: none !important;
}

/* Modern sidebar – uses project primary font (same as modern project) */
.sidebar-modern {
    font-family: var(--sidebar-font);
    font-size: 0.875rem;
    font-weight: 400;
    background: var(--sidebar-bg);
    color: var(--sidebar-foreground);
    width: var(--nav-bar-width, 260px);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.sidebar-modern::-webkit-scrollbar { display: none; width: 0; height: 0; }

.sidebar-inner {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    overflow: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.sidebar-inner::-webkit-scrollbar { display: none; width: 0; height: 0; }

.sidebar-header {
    padding: 1.25rem 1rem;
    cursor: pointer;
}

.sidebar-logo-text {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--sidebar-foreground);
}

.sidebar-nav {
    flex: 1;
    padding: 0 0.75rem;
    overflow-y: auto;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
}
.sidebar-nav::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    background: transparent !important;
}

.menu-content {
    list-style: none;
    padding: 0;
    margin: 0;
}

.nav-item {
    list-style: none;
    margin: 0 0 2px;
    padding: 0;
}

.nav-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    text-decoration: none;
    color: var(--sidebar-foreground);
    opacity: 0.85;
    transition: background-color 0.15s, color 0.15s, opacity 0.15s;
}

.nav-link:hover {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-accent-foreground);
    opacity: 1;
}

.nav-link.active {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-accent-foreground);
    opacity: 1;
    font-weight: 500;
}

.nav-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    opacity: 0.9;
}

.nav-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.nav-chevron {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    opacity: 0.7;
}

.nav-toggle {
    cursor: pointer;
    border: none;
    background: none;
}

.nav-disabled .nav-link {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: auto;
}

.nav-disabled .nav-link:hover {
    opacity: 0.6;
    background-color: transparent;
}

/* Sub-menu */
.sub-menu {
    list-style: none;
    padding: 0 0 0 0.5rem;
    margin: 0 0 4px 1rem;
    border-left: 1px solid var(--sidebar-border);
}

.sub-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
}

.sub-item:hover {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-accent-foreground);
}

.sub-item.active {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-accent-foreground);
}

.sub-item a,
.sub-item .sub-link {
    color: inherit;
    text-decoration: none;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.sub-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    opacity: 0.85;
}

.nav-badge {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: var(--sidebar-accent);
    color: var(--sidebar-accent-foreground);
    margin-left: auto;
}

/* Upload panel */
.upload-panel {
    margin: 0.5rem 0 0.75rem;
}

.upload-drop-zone {
    background: var(--sidebar-accent);
}

/* Modality item */
.modality-item .sub-link {
    flex: 1;
}

.echo-ok { color: #22c55e; font-size: 14px; }
.echo-fail { color: #ef4444; font-size: 14px; }

/* Summary cards */
.sidebar-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    padding: 1rem 1rem 1.25rem;
    border-top: 1px solid var(--sidebar-border);
}

.sidebar-card {
    background: var(--sidebar-card-bg);
    border-radius: 0.5rem;
    padding: 0.75rem;
    text-align: center;
}

.sidebar-card-icon {
    width: 20px;
    height: 20px;
    margin: 0 auto 0.25rem;
    display: block;
    opacity: 0.75;
}

.sidebar-card-value {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 2px;
}

.sidebar-card-label {
    font-size: 0.75rem;
    opacity: 0.75;
    margin: 0;
}

/* Footer */
.sidebar-footer {
    padding: 1rem 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
}

.logout-link {
    border-radius: 0.5rem;
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
