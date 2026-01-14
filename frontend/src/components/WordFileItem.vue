<script>
export default {
    name: 'WordFileItem',
    props: {
        wordFile: {
            type: Object,
            required: true
        },
        selected: {
            type: Boolean,
            default: false
        }
    },
    emits: ['selected', 'view', 'download', 'delete', 'print'],
    data() {
        return {
            loaded: true
        };
    },
    methods: {
        onSelectChange(event) {
            this.$emit('selected', this.wordFile.id, event.target.checked);
        },
        handleView() {
            this.$emit('view', this.wordFile.id);
        },
        handleDownload() {
            this.$emit('download', this.wordFile.id);
        },
        handleDelete() {
            this.$emit('delete', this.wordFile.id);
        },
        handlePrint() {
            this.$emit('print', this.wordFile.id);
        },
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }
    }
}
</script>

<template>
    <tbody>
        <tr v-if="loaded" class="study-row-collapsed">
            <td style="vertical-align: middle; padding-right: 8px;">
                <div class="form-check" style="display: flex; align-items: center; justify-content: center; height: 100%;">
                    <input class="form-check-input" type="checkbox" :checked="selected" @change="onSelectChange" style="margin: 0;">
                </div>
            </td>
            <td class="cut-text" data-bs-toggle="tooltip" :title="wordFile.originalFileName">
                {{ wordFile.originalFileName }}
            </td>
            <td class="cut-text" data-bs-toggle="tooltip" :title="wordFile.patientId">
                {{ wordFile.patientId }}
            </td>
            <td class="cut-text" data-bs-toggle="tooltip" :title="wordFile.patientName">
                {{ wordFile.patientName }}
            </td>
            <td class="cut-text" data-bs-toggle="tooltip" :title="wordFile.uploadedByName">
                {{ wordFile.uploadedByName }}
            </td>
            <td class="cut-text" data-bs-toggle="tooltip" :title="formatDate(wordFile.uploadedAt)">
                {{ formatDate(wordFile.uploadedAt) }}
            </td>
            <td>
                <button 
                    type="button" 
                    class="btn btn-sm btn-secondary m-1" 
                    @click="handleView"
                    title="View"
                >
                    <i class="bi bi-eye"></i>
                </button>
                <button 
                    type="button" 
                    class="btn btn-sm btn-secondary m-1" 
                    @click="handleDownload"
                    title="Download"
                >
                    <i class="bi bi-download"></i>
                </button>
                <button 
                    type="button" 
                    class="btn btn-sm btn-secondary m-1" 
                    @click="handlePrint"
                    title="Print"
                >
                    <i class="bi bi-printer"></i>
                </button>
                <button 
                    type="button" 
                    class="btn btn-sm btn-danger m-1" 
                    @click="handleDelete"
                    title="Delete"
                >
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    </tbody>
</template>

<style scoped>
.study-row-collapsed {
    border-top-width: 1px;
    border-color: #ddd;
}

.cut-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.btn-sm {
    padding: 4px 8px;
    font-size: 0.875rem;
}

.btn-secondary {
    background-color: var(--bs-secondary);
    border-color: var(--bs-secondary);
    color: var(--bs-white);
}

.btn-secondary:hover {
    background-color: var(--bs-secondary-dark);
    border-color: var(--bs-secondary-dark);
}

.btn-danger {
    background-color: var(--bs-danger);
    border-color: var(--bs-danger);
    color: var(--bs-white);
}

.btn-danger:hover {
    background-color: var(--bs-danger-dark);
    border-color: var(--bs-danger-dark);
}
</style>
