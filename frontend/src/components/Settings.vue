<script>

import { mapState } from "vuex"
import api from "../orthancApi"


export default {
    props: [],
    emits: [],
    data() {
        return {
            verboseLevel: "default",
            delayedDeletionPendingFilesCount: 0,
            advancedStoragePendingDeletionFilesCount: 0,
            advancedStorageIndexerModeEnabled: false,
            advancedStorageDelayedDeletionModeEnabled: false,
            hkLastProcessedChange: -1,
            hkLastChangeToProcess: -1,
        };
    },
    async mounted() {
        this.verboseLevel = await api.getVerboseLevel();
        await this.loadPluginsStatus();
    },
    methods: {
        async setVerboseLevel(level) {
            this.verboseLevel = level;
            await api.setVerboseLevel(level);
        },
        async loadPluginsStatus() {
            if (this.hasDelayedDeletionPlugin) {
                const ddStatus = await api.getDelayedDeletionStatus();
                this.delayedDeletionPendingFilesCount = ddStatus["FilesPendingDeletion"];
            }
            if (this.hasHousekeeperPlugin) {
                const hkStatus = await api.getHousekeeperStatus();
                this.hkLastChangeToProcess = hkStatus["LastChangeToProcess"];
                this.hkLastProcessedChange = hkStatus["LastProcessedChange"];
            }
            if (this.hasAdvancedStorage) {
                const advstStatus = await api.getAdvancedStorageStatus();
                this.advancedStorageDelayedDeletionModeEnabled = advstStatus["DelayedDeletionIsActive"];
                this.advancedStorageIndexerModeEnabled = advstStatus["IndexerIsActive"];
                this.advancedStoragePendingDeletionFilesCount = advstStatus["FilesPendingDeletion"];
            }
        }
    },
    watch: {
        async isConfigurationLoaded(newValue, oldValue) {
            this.loadPluginsStatus();
        }
    },
    computed: {
        ...mapState({
            uiOptions: state => state.configuration.uiOptions,
            isConfigurationLoaded: state => state.configuration.loaded,
            tokens: state => state.configuration.tokens,
            statistics: state => state.studies.statistics,
            system: state => state.configuration.system,
            installedPlugins: state => state.configuration.installedPlugins,
        }),
        totalDiskSize() {
            if (this.statistics.TotalDiskSizeMB > 1024 * 1024) {
                return (Math.round(this.statistics.TotalDiskSizeMB / (1024 * 1024) * 100) / 100) + " TB";
            }
            else if (this.statistics.TotalDiskSizeMB > 1024) {
                return (Math.round(this.statistics.TotalDiskSizeMB / 1024 * 100) / 100) + " GB";
            }
            return this.statistics.TotalDiskSizeMB + " MB";
        },
        hasMaxPatientCount() {
            return this.system.MaximumPatientCount > 0;
        },
        hasMaxStorageSize() {
            return this.system.MaximumStorageSize > 0;
        },
        maxStorageSize() {
            if (this.system.MaximumStorageSize > 1024 * 1024) {
                return (Math.round(this.system.MaximumStorageSize / (1024 * 1024) * 100) / 100) + " TB";
            }
            else if (this.statistics.TotalDiskSizeMB > 1024) {
                return (Math.round(this.system.MaximumStorageSize / 1024 * 100) / 100) + " GB";
            }
            return this.system.MaximumStorageSize + " MB";
        },
        hasDelayedDeletionPlugin() {
            return 'delayed-deletion' in this.installedPlugins && this.installedPlugins['delayed-deletion'].Enabled;
        },
        hasAdvancedStorageDelayedDeletion() {
            return 'advanced-storage' in this.installedPlugins &&
                this.installedPlugins['advanced-storage'].Enabled &&
                this.advancedStorageDelayedDeletionModeEnabled;
        },
        hasHousekeeperPlugin() {
            return 'housekeeper' in this.installedPlugins && this.installedPlugins['housekeeper'].Enabled;
        },
        hkPctDone() {
            if (this.hkLastProcessedChange >= 1) {
                return 100 * (this.hkLastProcessedChange / this.hkLastChangeToProcess);
            } else {
                return 100;
            }
        },
        hkPctRemaining() {
            return 100 - this.hkPctDone;
        },
        hkStatusText() {
            if (this.hkLastProcessedChange >= 1) {
                return this.hkLastProcessedChange +" / " + this.hkLastChangeToProcess;
            } else {
                return this.$t('plugins.housekeeper.completed')
            }
        }
    },
}
</script>
<template>
    <div class="settings-page">
        <div class="settings-header">
            <div class="settings-title">
                <h2 class="mb-1">System Information</h2>
                <p class="text-muted mb-0">EMEDX System Details</p>
            </div>
        </div>

        <div class="settings-grid">
            <section class="card settings-card">
                <div class="card-body">
                    <div class="section-head">
                        <h5 class="section-title mb-0">{{ $t('settings.statistics') }}</h5>
                    </div>

                    <div class="kv">
                        <div class="kv-row">
                            <div class="kv-key"># {{ $t('patients') }}</div>
                            <div class="kv-val" v-if="!hasMaxPatientCount">{{ statistics.CountPatients }}</div>
                            <div class="kv-val" v-else>
                                {{ statistics.CountPatients }} / {{ system.MaximumPatientCount }} ({{ system.MaximumStorageMode }})
                            </div>
                        </div>
                        <div class="kv-row">
                            <div class="kv-key"># {{ $t('studies') }}</div>
                            <div class="kv-val">{{ statistics.CountStudies }}</div>
                        </div>
                        <div class="kv-row">
                            <div class="kv-key"># {{ $t('series_plural') }}</div>
                            <div class="kv-val">{{ statistics.CountSeries }}</div>
                        </div>
                        <div class="kv-row">
                            <div class="kv-key"># {{ $t('instances') }}</div>
                            <div class="kv-val">{{ statistics.CountInstances }}</div>
                        </div>
                        <div class="kv-row">
                            <div class="kv-key">{{ $t('settings.storage_size') }}</div>
                            <div class="kv-val" v-if="!hasMaxStorageSize">{{ totalDiskSize }}</div>
                            <div class="kv-val" v-else>
                                {{ totalDiskSize }} / {{ maxStorageSize }} ({{ system.MaximumStorageMode }})
                            </div>
                        </div>

                        <div class="kv-row" v-if="hasDelayedDeletionPlugin">
                            <div class="kv-key"># {{ $t('plugins.delayed_deletion.pending_files_count') }}</div>
                            <div class="kv-val">{{ delayedDeletionPendingFilesCount }}</div>
                        </div>
                        <div class="kv-row" v-if="hasAdvancedStorageDelayedDeletion">
                            <div class="kv-key"># {{ $t('plugins.advanced_storage.pending_deletion_files_count') }}</div>
                            <div class="kv-val">{{ advancedStoragePendingDeletionFilesCount }}</div>
                        </div>
                        <div class="kv-row" v-if="hasHousekeeperPlugin">
                            <div class="kv-key">{{ $t('plugins.housekeeper.progress_status') }}</div>
                            <div class="kv-val">
                                <div v-if="hkPctDone >= 100" class="status-badge-completed">
                                    {{ $t('plugins.housekeeper.completed') }}
                                </div>
                                <div v-else class="progress mt-1 mb-1 w-100">
                                    <div class="progress-bar bg-success" role="progressbar"
                                        v-bind:style="'width: ' + this.hkPctDone + '%'">
                                        <span v-if="hkPctDone > 50">{{ hkStatusText }}</span>
                                    </div>
                                    <div class="progress-bar bg-secondary" role="progressbar"
                                        v-bind:style="'width: ' + this.hkPctRemaining + '%'">
                                        <span v-if="hkPctDone <= 50">{{ hkStatusText }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="card settings-card">
                <div class="card-body">
                    <div class="section-head">
                        <h5 class="section-title mb-0">EMEDX System Info</h5>
                    </div>

                    <div class="kv">
                        <div class="kv-row">
                            <div class="kv-key">EMEDX Version</div>
                            <div class="kv-val">1.0</div>
                        </div>
                        <div class="kv-row">
                            <div class="kv-key">{{ $t('settings.dicom_AET') }}</div>
                            <div class="kv-val">{{ system.DicomAet }}</div>
                        </div>
                        <div class="kv-row">
                            <div class="kv-key">{{ $t('settings.dicom_port') }}</div>
                            <div class="kv-val">{{ system.DicomPort }}</div>
                        </div>
                        <div class="kv-row">
                            <div class="kv-key">{{ $t('settings.ingest_transcoding') }}</div>
                            <div class="kv-val">{{ system.IngestTranscoding }}</div>
                        </div>
                        <div class="kv-row">
                            <div class="kv-key">{{ $t('settings.overwrite_instances') }}</div>
                            <div class="kv-val">{{ system.OverwriteInstances }}</div>
                        </div>
                        <div class="kv-row">
                            <div class="kv-key">{{ $t('settings.storage_compression') }}</div>
                            <div class="kv-val">{{ system.StorageCompression }}</div>
                        </div>
                        <div class="kv-row">
                            <div class="kv-key">{{ $t('settings.read_only') }}</div>
                            <div class="kv-val">{{ system.ReadOnly }}</div>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <section class="card settings-card mt-3">
            <div class="card-body">
                <div class="section-head">
                    <h5 class="section-title mb-0">{{ $t('settings.verbosity_level') }}</h5>
                </div>
                <div class="btn-group" role="group" aria-label="Verbosity">
                    <button type="button" class="btn"
                        @click="setVerboseLevel('default')"
                        :class="{ 'btn-primary': verboseLevel == 'default', 'btn-outline-secondary': verboseLevel != 'default' }">
                        {{ $t('default') }}
                    </button>
                    <button type="button" class="btn"
                        @click="setVerboseLevel('verbose')"
                        :class="{ 'btn-primary': verboseLevel == 'verbose', 'btn-outline-secondary': verboseLevel != 'verbose' }">
                        {{ $t('verbose') }}
                    </button>
                    <button type="button" class="btn"
                        @click="setVerboseLevel('trace')"
                        :class="{ 'btn-primary': verboseLevel == 'trace', 'btn-outline-secondary': verboseLevel != 'trace' }">
                        {{ $t('trace') }}
                    </button>
                </div>
            </div>
        </section>

        <section class="card settings-card mt-3">
            <div class="card-body">
                <div class="section-head">
                    <h5 class="section-title mb-0">{{ $t('settings.installed_plugins') }}</h5>
                    <p class="text-muted small mb-0">
                        {{ $t('settings.plugins_not_enabled') }}
                        <span class="disabled-example">{{ $t('settings.striked_through') }}</span>
                    </p>
                </div>

                <div class="table-responsive">
                    <table class="table table-sm align-middle mb-0">
                        <tbody>
                            <tr v-for="(configuration, plugin) in installedPlugins" :key="plugin"
                                :class="{ 'disabled-plugin': !configuration.Enabled }">
                                <th scope="row" class="plugin-name">{{ plugin }}</th>
                                <td class="plugin-desc">{{ configuration.Description }}</td>
                                <td class="plugin-ver">{{ configuration.Version }}</td>
                                <td class="plugin-action" v-if="!this.tokens.RequiredForLinks">
                                    <!-- If tokens are required for links, no need to display links to plugin UI, they usually don't support links and won't work -->
                                    <a v-if="configuration.RootUri && configuration.Enabled" type="button"
                                        class="btn btn-sm btn-primary" v-bind:href="configuration.RootUri">{{ $t('open') }}</a>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    </div>
</template>
<style scoped>
.settings-page {
    text-align: left;
    max-width: 1100px;
    padding: 20px 16px 28px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
}

.settings-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
}

.settings-title h2 {
    font-size: 18px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    color: #111827;
}

.settings-title .text-muted {
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #6b7280;
    margin-top: 4px;
}

.settings-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
}

@media (max-width: 900px) {
    .settings-grid {
        grid-template-columns: 1fr;
    }
}

.settings-card {
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    background: #ffffff;
}

.settings-card .card-body {
    padding: 16px;
}

.section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
}

.section-title {
    font-weight: 600;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #111827;
    margin: 0;
}

.kv {
    display: grid;
    gap: 6px;
}

.kv-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    padding: 10px 12px;
    border-radius: 6px;
    background: #f9fafb;
    border: 1px solid #f3f4f6;
    transition: background-color 0.15s ease;
}

.kv-row:hover {
    background: #f3f4f6;
}

.kv-key {
    color: #374151;
    font-weight: 500;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.kv-val {
    color: #111827;
    font-weight: 500;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    text-align: right;
    white-space: nowrap;
}

.disabled-plugin {
    opacity: 0.5;
    text-decoration: line-through;
}

.disabled-example {
    text-decoration: line-through;
}

.plugin-name {
    width: 220px;
    font-weight: 600;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.plugin-desc {
    color: #374151;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.plugin-ver {
    width: 140px;
    text-align: right;
    color: #111827;
    white-space: nowrap;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.plugin-action {
    width: 110px;
    text-align: right;
}

.table {
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.table th,
.table td {
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    padding: 10px 12px;
}

.btn-group .btn {
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    padding: 6px 14px;
}

.text-muted {
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.progress {
    height: 8px;
    border-radius: 4px;
}

[data-bs-theme="dark"] .settings-card {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    background: #1f2937;
}

[data-bs-theme="dark"] .kv-row {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.05);
}

[data-bs-theme="dark"] .kv-row:hover {
    background: rgba(255, 255, 255, 0.06);
}

[data-bs-theme="dark"] .kv-key,
[data-bs-theme="dark"] .plugin-desc {
    color: #d1d5db;
}

[data-bs-theme="dark"] .kv-val,
[data-bs-theme="dark"] .plugin-ver,
[data-bs-theme="dark"] .settings-title h2 {
    color: #f9fafb;
}

[data-bs-theme="dark"] .settings-title .text-muted {
    color: #9ca3af;
}

.status-badge-completed {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    background-color: #d1fae5;
    color: #065f46;
    border-radius: 6px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-weight: 500;
    white-space: nowrap;
    line-height: 1.4;
}

[data-bs-theme="dark"] .status-badge-completed {
    background-color: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
}
</style>