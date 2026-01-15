<script>
import { mapState } from "vuex"
import api from "../orthancApi"

export default {
    name: 'Dashboard',
    data() {
        return {
            stats: {
                totalStudies: 0,
                totalPatients: 0,
                totalDocuments: 0,
                recentStudies: [],
                recentDocuments: []
            },
            loading: true
        };
    },
    computed: {
        ...mapState({
            statistics: state => state.studies.statistics,
            userProfile: state => state.configuration.userProfile
        }),
        userName() {
            if (this.userProfile && this.userProfile.name) {
                return this.userProfile.name;
            }
            const userData = localStorage.getItem('user-data');
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    return user.name || user.email || 'User';
                } catch (e) {
                    return 'User';
                }
            }
            return 'User';
        }
    },
    async mounted() {
        await this.loadDashboardData();
    },
    methods: {
        async loadDashboardData() {
            this.loading = true;
            try {
                // Load statistics
                await this.$store.dispatch('studies/loadStatistics');
                
                // Load patients count
                const patientsResponse = await api.getPatients();
                if (patientsResponse.success) {
                    this.stats.totalPatients = patientsResponse.patients?.length || 0;
                }
                
                // Load documents count
                const docsResponse = await api.getWordFiles();
                if (docsResponse.success) {
                    this.stats.totalDocuments = docsResponse.wordFiles?.length || 0;
                    // Get recent documents (last 5)
                    this.stats.recentDocuments = (docsResponse.wordFiles || [])
                        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
                        .slice(0, 5);
                }
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                this.loading = false;
            }
        },
        navigateTo(path) {
            this.$router.push(path);
        },
        formatDate(dateString) {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },
        formatDiskSize(mb) {
            if (!mb) return '0 MB';
            if (mb >= 1024) {
                return (mb / 1024).toFixed(2) + ' GB';
            }
            return mb.toFixed(2) + ' MB';
        }
    }
}
</script>

<template>
    <div class="dashboard-container">
        <!-- Header Section -->
        <div class="dashboard-header">
            <div class="welcome-section">
                <h1 class="welcome-title">Welcome back, {{ userName }}</h1>
                <p class="welcome-subtitle">Here's your medical imaging workspace overview</p>
            </div>
            <div class="header-actions">
                <button class="btn-refresh" @click="loadDashboardData" :disabled="loading">
                    <i class="bi bi-arrow-clockwise" :class="{ 'spin': loading }"></i>
                    Refresh
                </button>
            </div>
        </div>

        <!-- Stats Cards -->
        <div class="stats-grid">
            <div class="stat-card" @click="navigateTo('/studies')">
                <div class="stat-icon studies">
                    <i class="bi bi-file-earmark-medical"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value">{{ statistics.CountStudies || 0 }}</span>
                    <span class="stat-label">DICOM Studies</span>
                </div>
                <div class="stat-arrow">
                    <i class="bi bi-arrow-right"></i>
                </div>
            </div>

            <div class="stat-card" @click="navigateTo('/patients')">
                <div class="stat-icon patients">
                    <i class="bi bi-people"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value">{{ stats.totalPatients }}</span>
                    <span class="stat-label">Patients</span>
                </div>
                <div class="stat-arrow">
                    <i class="bi bi-arrow-right"></i>
                </div>
            </div>

            <div class="stat-card" @click="navigateTo('/word-files')">
                <div class="stat-icon documents">
                    <i class="bi bi-file-earmark-word"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value">{{ stats.totalDocuments }}</span>
                    <span class="stat-label">Documents</span>
                </div>
                <div class="stat-arrow">
                    <i class="bi bi-arrow-right"></i>
                </div>
            </div>

            <div class="stat-card" @click="navigateTo('/studies')">
                <div class="stat-icon series">
                    <i class="bi bi-layers"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-value">{{ statistics.CountSeries || 0 }}</span>
                    <span class="stat-label">Series</span>
                </div>
                <div class="stat-arrow">
                    <i class="bi bi-arrow-right"></i>
                </div>
            </div>
        </div>

        <!-- Quick Actions -->
        <div class="section">
            <h2 class="section-title">Quick Actions</h2>
            <div class="quick-actions-grid">
                <div class="quick-action-card" @click="navigateTo('/studies')">
                    <i class="bi bi-search"></i>
                    <span>Browse Studies</span>
                </div>
                <div class="quick-action-card" @click="navigateTo('/patients')">
                    <i class="bi bi-person-plus"></i>
                    <span>View Patients</span>
                </div>
                <div class="quick-action-card" @click="navigateTo('/word-files')">
                    <i class="bi bi-file-text"></i>
                    <span>View Documents</span>
                </div>
                <div class="quick-action-card" @click="navigateTo('/settings')">
                    <i class="bi bi-gear"></i>
                    <span>Settings</span>
                </div>
            </div>
        </div>

        <!-- Recent Documents -->
        <div class="section" v-if="stats.recentDocuments.length > 0">
            <h2 class="section-title">Recent Documents</h2>
            <div class="recent-list">
                <div 
                    v-for="doc in stats.recentDocuments" 
                    :key="doc.id" 
                    class="recent-item"
                    @click="navigateTo('/word-files')"
                >
                    <div class="recent-icon">
                        <i class="bi bi-file-earmark-word"></i>
                    </div>
                    <div class="recent-info">
                        <span class="recent-title">{{ doc.originalFileName }}</span>
                        <span class="recent-meta">
                            <span class="patient-id">{{ doc.patientId }}</span>
                            <span class="separator">•</span>
                            <span class="date">{{ formatDate(doc.uploadedAt) }}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- System Info -->
        <div class="section">
            <h2 class="section-title">System Information</h2>
            <div class="system-info-grid">
                <div class="system-info-item">
                    <span class="system-info-label">Total Instances</span>
                    <span class="system-info-value">{{ statistics.CountInstances || 0 }}</span>
                </div>
                <div class="system-info-item">
                    <span class="system-info-label">Disk Size</span>
                    <span class="system-info-value">{{ formatDiskSize(statistics.TotalDiskSizeMB) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.dashboard-container {
    padding: 30px;
    max-width: 1400px;
    margin: 0 auto;
}

.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 30px;
}

.welcome-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--bs-body-color);
    margin-bottom: 8px;
}

.welcome-subtitle {
    font-size: 14px;
    color: var(--bs-secondary-color);
    margin: 0;
}

.btn-refresh {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: white;
    color: var(--bs-body-color);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-refresh:hover:not(:disabled) {
    background: #f8f9fa;
    border-color: #d0d0d0;
}

.btn-refresh:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-refresh .spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* Stats Grid */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-bottom: 40px;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px;
    background: white;
    border-radius: 16px;
    border: 1px solid #e8e8e8;
    cursor: pointer;
    transition: all 0.3s ease;
}

.stat-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
    border-color: #d0d0d0;
}

.stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
}

.stat-icon.studies {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.stat-icon.patients {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    color: white;
}

.stat-icon.documents {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
}

.stat-icon.series {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    color: white;
}

.stat-info {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--bs-body-color);
    line-height: 1.2;
}

.stat-label {
    font-size: 13px;
    color: var(--bs-secondary-color);
    margin-top: 4px;
}

.stat-arrow {
    color: #ccc;
    font-size: 20px;
    transition: transform 0.2s;
}

.stat-card:hover .stat-arrow {
    transform: translateX(4px);
    color: #666;
}

/* Section */
.section {
    margin-bottom: 40px;
}

.section-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--bs-body-color);
    margin-bottom: 20px;
}

/* Quick Actions */
.quick-actions-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
}

.quick-action-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: white;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    gap: 12px;
}

.quick-action-card:hover {
    background: #f8f9fa;
    border-color: #4a90e2;
}

.quick-action-card i {
    font-size: 28px;
    color: #4a90e2;
}

.quick-action-card span {
    font-size: 14px;
    font-weight: 500;
    color: var(--bs-body-color);
}

/* Recent List */
.recent-list {
    background: white;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
    overflow: hidden;
}

.recent-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: background 0.2s;
}

.recent-item:last-child {
    border-bottom: none;
}

.recent-item:hover {
    background: #f8f9fa;
}

.recent-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: rgba(74, 144, 226, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4a90e2;
    font-size: 18px;
}

.recent-info {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.recent-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--bs-body-color);
}

.recent-meta {
    font-size: 12px;
    color: var(--bs-secondary-color);
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.separator {
    opacity: 0.5;
}

/* System Info */
.system-info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
}

.system-info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: white;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
}

.system-info-label {
    font-size: 14px;
    color: var(--bs-secondary-color);
}

.system-info-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--bs-body-color);
}

/* Responsive */
@media (max-width: 1200px) {
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .quick-actions-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 768px) {
    .dashboard-container {
        padding: 20px;
    }
    
    .dashboard-header {
        flex-direction: column;
        gap: 16px;
    }
    
    .stats-grid,
    .quick-actions-grid {
        grid-template-columns: 1fr;
    }
    
    .system-info-grid {
        grid-template-columns: 1fr;
    }
}
</style>
