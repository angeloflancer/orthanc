<script>
import { mapState } from "vuex"
import api from "../orthancApi"
import axios from 'axios';
import { orthancApiUrl } from '../globalConfigurations';

export default {
    name: 'Dashboard',
    data() {
        return {
            stats: {
                totalStudies: 0,
                totalPatients: 0,
                totalDocuments: 0,
                recentDocuments: []
            },
            loading: true,
            expirationWarning: null,
            currentTime: new Date()
        };
    },
    computed: {
        ...mapState({
            statistics: state => state.studies.statistics,
            userProfile: state => state.configuration.userProfile
        }),
        userFullName() {
            if (this.userProfile && this.userProfile.name) {
                return this.userProfile.name;
            }
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
            return null;
        },
        formattedTime() {
            return this.currentTime.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
        },
        formattedDate() {
            return this.currentTime.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }
    },
    async mounted() {
        await this.loadDashboardData();
        await this.checkExpiration();
        setInterval(() => {
            this.currentTime = new Date();
        }, 60000);
    },
    methods: {
        async loadDashboardData() {
            this.loading = true;
            try {
                await this.$store.dispatch('studies/loadStatistics');
                
                const patientsResponse = await api.getPatients();
                if (patientsResponse.success) {
                    this.stats.totalPatients = patientsResponse.patients?.length || 0;
                }
                
                const docsResponse = await api.getWordFiles();
                if (docsResponse.success) {
                    this.stats.totalDocuments = docsResponse.wordFiles?.length || 0;
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
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        formatDiskSize(mb) {
            if (!mb) return '0 MB';
            if (mb >= 1024) {
                return (mb / 1024).toFixed(1) + ' GB';
            }
            return mb.toFixed(0) + ' MB';
        },
        async checkExpiration() {
            try {
                const token = localStorage.getItem('auth-token');
                if (!token) return;
                
                const response = await axios.get(`${orthancApiUrl}api/subscriptions/check-expiration`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.data.success && response.data.hasWarning) {
                    this.expirationWarning = {
                        days: response.data.daysUntilExpiration,
                        message: response.data.message
                    };
                }
            } catch (error) {
                console.error('Error checking expiration:', error);
            }
        }
    }
}
</script>

<template>
    <div class="dashboard-container">
        <!-- Header -->
        <div class="header-section">
            <div class="header-content">
                <div class="greeting-container">
                    <h1 class="greeting">Dashboard</h1>
                    <p class="subtitle">Welcome back, Dr. {{ userFullName || 'User' }}</p>
                </div>
                <div class="time-display">
                    <div class="time">{{ formattedTime }}</div>
                    <div class="date">{{ formattedDate }}</div>
                </div>
            </div>
            <button class="refresh-button" @click="loadDashboardData" :disabled="loading">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
                <span>Refresh</span>
            </button>
        </div>

        <!-- Warning Alert -->
        <div v-if="expirationWarning" class="warning-alert">
            <div class="alert-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.694-.833-2.464 0L4.232 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
                <div>
                    <strong>Subscription Expiring</strong>
                    <p>{{ expirationWarning.message }}</p>
                </div>
            </div>
            <button @click="expirationWarning = null" class="alert-close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>

        <!-- Main Stats -->
        <div class="stats-grid">
            <div class="stat-card" @click="navigateTo('/studies')">
                <div class="stat-header">
                    <div class="stat-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </div>
                    <div class="stat-title">DICOM Studies</div>
                </div>
                <div class="stat-value">{{ statistics.CountStudies || 0 }}</div>
                <div class="stat-trend">+12% from last month</div>
            </div>

            <div class="stat-card" @click="navigateTo('/patients')">
                <div class="stat-header">
                    <div class="stat-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                    </div>
                    <div class="stat-title">Patients</div>
                </div>
                <div class="stat-value">{{ stats.totalPatients }}</div>
                <div class="stat-trend">+8 active patients</div>
            </div>

            <div class="stat-card" @click="navigateTo('/word-files')">
                <div class="stat-header">
                    <div class="stat-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </div>
                    <div class="stat-title">Medical Reports</div>
                </div>
                <div class="stat-value">{{ stats.totalDocuments }}</div>
                <div class="stat-trend">5 unprocessed</div>
            </div>

            <div class="stat-card" @click="navigateTo('/studies')">
                <div class="stat-header">
                    <div class="stat-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                        </svg>
                    </div>
                    <div class="stat-title">Image Series</div>
                </div>
                <div class="stat-value">{{ statistics.CountSeries || 0 }}</div>
                <div class="stat-trend">+15% from last week</div>
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="activity-section">
            <div class="section-header">
                <h2>Recent Activity</h2>
                <button class="view-all" @click="navigateTo('/word-files')">View All</button>
            </div>
            
            <div class="activity-grid">
                <div class="activity-card">
                    <div class="activity-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <path d="M14 2v6h6"/>
                            <path d="M16 13H8"/>
                            <path d="M16 17H8"/>
                            <path d="M10 9H8"/>
                        </svg>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">Recent Documents</div>
                        <div class="activity-list">
                            <div 
                                v-for="doc in stats.recentDocuments" 
                                :key="doc.id" 
                                class="activity-item"
                                @click="navigateTo('/word-files')"
                            >
                                <div class="item-title">{{ doc.originalFileName }}</div>
                                <div class="item-meta">{{ formatDate(doc.uploadedAt) }}</div>
                            </div>
                            <div v-if="stats.recentDocuments.length === 0" class="empty-state">
                                No recent documents
                            </div>
                        </div>
                    </div>
                </div>

                <div class="activity-card">
                    <div class="activity-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">Quick Actions</div>
                        <div class="actions-list">
                            <div class="action-item" @click="navigateTo('/studies')">
                                <div class="action-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="11" cy="11" r="8"/>
                                        <path d="M21 21l-4.35-4.35"/>
                                    </svg>
                                </div>
                                <div class="action-text">Browse Studies</div>
                                <div class="action-arrow">→</div>
                            </div>
                            <div class="action-item" @click="navigateTo('/patients')">
                                <div class="action-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                                        <circle cx="8.5" cy="7" r="4"/>
                                        <path d="M20 8v6M23 11h-6"/>
                                    </svg>
                                </div>
                                <div class="action-text">Add Patient</div>
                                <div class="action-arrow">→</div>
                            </div>
                            <div class="action-item" @click="navigateTo('/word-files')">
                                <div class="action-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                                    </svg>
                                </div>
                                <div class="action-text">Upload Report</div>
                                <div class="action-arrow">→</div>
                            </div>
                            <div class="action-item" @click="navigateTo('/settings')">
                                <div class="action-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="3"/>
                                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                                    </svg>
                                </div>
                                <div class="action-text">System Settings</div>
                                <div class="action-arrow">→</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- System Overview -->
        <div class="system-section">
            <div class="section-header">
                <h2>System Overview</h2>
            </div>
            <div class="system-grid">
                <div class="system-card">
                    <div class="system-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                        </svg>
                    </div>
                    <div class="system-content">
                        <div class="system-title">Total Instances</div>
                        <div class="system-value">{{ statistics.CountInstances || 0 }}</div>
                        <div class="system-subtitle">DICOM Instances</div>
                    </div>
                </div>

                <div class="system-card">
                    <div class="system-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                        </svg>
                    </div>
                    <div class="system-content">
                        <div class="system-title">Storage Usage</div>
                        <div class="system-value">{{ formatDiskSize(statistics.TotalDiskSizeMB) }}</div>
                        <div class="system-subtitle">Total Disk Space</div>
                    </div>
                </div>

                <div class="system-card">
                    <div class="system-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                            <path d="M22 4L12 14.01l-3-3"/>
                        </svg>
                    </div>
                    <div class="system-content">
                        <div class="system-title">System Status</div>
                        <div class="system-value">Operational</div>
                        <div class="system-subtitle">All systems normal</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.dashboard-container {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    background: #fafbfc;
    min-height: 100vh;
}

/* Header Section */
.header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
}

.header-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.greeting {
    font-size: 2rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
    letter-spacing: -0.025em;
}

.subtitle {
    font-size: 1rem;
    color: #6b7280;
    margin: 0;
    font-weight: 400;
}

.time-display {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.time {
    font-size: 1.5rem;
    font-weight: 500;
    color: #111827;
    font-variant-numeric: tabular-nums;
}

.date {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 400;
}

.refresh-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #111827;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    height: fit-content;
}

.refresh-button:hover:not(:disabled) {
    background: #1f2937;
    transform: translateY(-1px);
}

.refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Warning Alert */
.warning-alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: #fffbeb;
    border: 1px solid #fbbf24;
    border-radius: 0.5rem;
    margin-bottom: 2rem;
}

.alert-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #92400e;
}

.alert-content strong {
    font-weight: 600;
    display: block;
    margin-bottom: 0.125rem;
}

.alert-content p {
    margin: 0;
    font-size: 0.875rem;
    color: #92400e;
}

.alert-close {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: #92400e;
    border-radius: 0.25rem;
    transition: background-color 0.2s ease;
}

.alert-close:hover {
    background: rgba(146, 64, 14, 0.1);
}

/* Stats Grid */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2.5rem;
}

.stat-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    border-color: #d1d5db;
}

.stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
}

.stat-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.stat-icon {
    width: 3rem;
    height: 3rem;
    background: #3b82f6;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.stat-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
}

.stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    line-height: 1;
    margin-bottom: 0.5rem;
}

.stat-trend {
    font-size: 0.75rem;
    color: #10b981;
    font-weight: 500;
}

/* Activity Section */
.activity-section {
    margin-bottom: 2.5rem;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.section-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
}

.view-all {
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s ease;
}

.view-all:hover {
    background: #e5e7eb;
    border-color: #d1d5db;
}

.activity-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
}

.activity-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.5rem;
}

.activity-icon {
    width: 2.5rem;
    height: 2.5rem;
    background: #f3f4f6;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
    color: #374151;
}

.activity-title {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 1rem;
}

.activity-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.activity-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.activity-item:hover {
    background: #f9fafb;
}

.item-title {
    font-size: 0.875rem;
    color: #374151;
    font-weight: 500;
}

.item-meta {
    font-size: 0.75rem;
    color: #6b7280;
}

.empty-state {
    text-align: center;
    padding: 2rem 1rem;
    color: #9ca3af;
    font-size: 0.875rem;
}

.actions-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.action-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.action-item:hover {
    background: #f9fafb;
}

.action-icon {
    width: 2rem;
    height: 2rem;
    background: #f3f4f6;
    border-radius: 0.375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #374151;
}

.action-text {
    flex: 1;
    font-size: 0.875rem;
    color: #374151;
    font-weight: 500;
}

.action-arrow {
    color: #9ca3af;
    font-size: 1.125rem;
}

/* System Section */
.system-section {
    margin-bottom: 2rem;
}

.system-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
}

.system-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
}

.system-icon {
    width: 3rem;
    height: 3rem;
    background: #f3f4f6;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #374151;
}

.system-content {
    flex: 1;
}

.system-title {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
    margin-bottom: 0.25rem;
}

.system-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.25rem;
}

.system-subtitle {
    font-size: 0.75rem;
    color: #9ca3af;
}

/* Responsive Design */
@media (max-width: 1024px) {
    .activity-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 768px) {
    .dashboard-container {
        padding: 1rem;
    }
    
    .header-section {
        flex-direction: column;
        gap: 1rem;
    }
    
    .refresh-button {
        align-self: flex-start;
    }
    
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .activity-grid,
    .system-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 640px) {
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .greeting {
        font-size: 1.5rem;
    }
    
    .stat-value {
        font-size: 1.75rem;
    }
}

/* Loading States */
.stat-card.loading,
.activity-card.loading,
.system-card.loading {
    position: relative;
    overflow: hidden;
}

.stat-card.loading::after,
.activity-card.loading::after,
.system-card.loading::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0,
        rgba(255, 255, 255, 0.2) 20%,
        rgba(255, 255, 255, 0.5) 60%,
        rgba(255, 255, 255, 0)
    );
    animation: shimmer 2s infinite;
}

@keyframes shimmer {
    100% {
        transform: translateX(100%);
    }
}
</style>