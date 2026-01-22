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
        userFullName() {
            // First try userProfile from store
            if (this.userProfile && this.userProfile.name) {
                return this.userProfile.name;
            }
            // Then try localStorage
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    if (user.name) {
                        return user.name;
                    }
                } catch (e) {
                    console.error('Error parsing user data:', e);
                }
            }
            return null; // Return null if no name found, so we can show a fallback
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
                <h1 class="welcome-title">
                    <span class="welcome-greeting">Welcome back</span>
                    <span v-if="userFullName" class="welcome-name">{{ userFullName }}</span>
                    <span v-else class="welcome-name">there</span>
                </h1>
                <p class="welcome-subtitle">Here's what's happening in your workspace today</p>
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
    padding: 32px 40px;
    max-width: 1400px;
    margin: 0 auto;
}

.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 48px;
    padding-bottom: 28px;
    border-bottom: 1px solid #e5e7eb;
}

.welcome-section {
    flex: 1;
}

.welcome-title {
    font-size: 34px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 12px;
    line-height: 1.3;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    letter-spacing: -0.02em;
}

.welcome-greeting {
    color: #374151;
    font-weight: 500;
}

.welcome-name {
    color: #111827;
    font-weight: 600;
}

.welcome-subtitle {
    font-size: 15px;
    color: #6b7280;
    margin: 0;
    font-weight: 400;
    line-height: 1.6;
}

.btn-refresh {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: white;
    color: #4a5568;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.btn-refresh:hover:not(:disabled) {
    background: #f7fafc;
    border-color: #cbd5e0;
    color: #2d3748;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
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
    gap: 18px;
    padding: 28px 24px;
    background: white;
    border-radius: 14px;
    border: 1px solid #e8e8e8;
    cursor: pointer;
    transition: all 0.25s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
    border-color: #d1d5db;
}

.stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
}

.stat-icon.studies {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
}

.stat-icon.patients {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
}

.stat-icon.documents {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
}

.stat-icon.series {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
}

.stat-info {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 30px;
    font-weight: 600;
    color: #1a202c;
    line-height: 1.2;
    letter-spacing: -0.5px;
}

.stat-label {
    font-size: 13px;
    color: #718096;
    margin-top: 6px;
    font-weight: 400;
}

.stat-arrow {
    color: #9ca3af;
    font-size: 18px;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.stat-card:hover .stat-arrow {
    transform: translateX(3px);
    color: #4b5563;
}

/* Section */
.section {
    margin-bottom: 40px;
}

.section-title {
    font-size: 20px;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 20px;
    letter-spacing: -0.3px;
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
    padding: 28px 24px;
    background: white;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    gap: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.quick-action-card:hover {
    background: #f7fafc;
    border-color: #4a90e2;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.12);
}

.quick-action-card i {
    font-size: 28px;
    color: #4a90e2;
    transition: transform 0.2s ease;
}

.quick-action-card:hover i {
    transform: scale(1.1);
}

.quick-action-card span {
    font-size: 14px;
    font-weight: 500;
    color: #4a5568;
}

/* Recent List */
.recent-list {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.recent-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
    transition: all 0.2s ease;
}

.recent-item:last-child {
    border-bottom: none;
}

.recent-item:hover {
    background: #f9fafb;
}

.recent-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(59, 130, 246, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
    font-size: 18px;
    flex-shrink: 0;
}

.recent-info {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.recent-title {
    font-size: 14px;
    font-weight: 500;
    color: #111827;
    line-height: 1.4;
}

.recent-meta {
    font-size: 12px;
    color: #6b7280;
    margin-top: 6px;
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
    padding: 18px 20px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.system-info-label {
    font-size: 14px;
    color: #6b7280;
    font-weight: 400;
}

.system-info-value {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
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
