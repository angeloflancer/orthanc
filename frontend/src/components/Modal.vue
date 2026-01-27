<script>

export default {
  props: ["id", "headerText", "bodyText", "cancelText", "okText"],
  methods: {
    ok() {
      this.$emit('ok');
    }
  },
  mounted() {
    this.$refs['modal-main-div'].addEventListener('show.bs.modal', (e) => {
      // move the modal to body to avoid z-index issues: https://weblog.west-wind.com/posts/2016/sep/14/bootstrap-modal-dialog-showing-under-modal-background
      document.querySelector('body').appendChild(e.target);
    });
  }
};
</script>

<template>
  <div class="modal fade" :id="this.id" tabindex="-1" aria-labelledby="modalLabel" ref="modal-main-div">
    <!-- aria-hidden="true" -->
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="modalLabel">{{ headerText }}</h5><!-- Can't use v-html here since the headerText can contain DICOM Tags including XSS code -->
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <slot name="modalBody">
            <span v-html="bodyText"></span><!-- Safe to use v-html here since the bodyText only contains translated messages -->
          </slot>
        </div>
        <div class="modal-footer">
          <button v-if="cancelText" type="button" class="btn btn-secondary" data-bs-dismiss="modal">{{ cancelText
          }}</button>
          <button type="button" class="btn btn-primary" data-bs-dismiss="modal" @click="ok()">{{ okText }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Modern Modal Styling */
.modal-dialog {
    max-width: 600px;
}

.modal-content {
    border: none;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    overflow: hidden;
}

.modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7eb;
    background: white;
}

.modal-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    margin: 0;
}

.modal-body {
    padding: 24px;
    background: white;
}

.modal-footer {
    padding: 16px 24px;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.modal-footer .btn {
    border-radius: 8px;
    padding: 10px 20px;
    font-weight: 500;
    transition: all 0.2s ease;
}

.modal-footer .btn-primary {
    background: #2563eb;
    border: none;
    color: white;
}

.modal-footer .btn-primary:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.modal-footer .btn-secondary {
    background: white;
    border: 1px solid #e5e7eb;
    color: #374151;
}

.modal-footer .btn-secondary:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
}

.btn-close {
    opacity: 0.6;
    transition: all 0.2s ease;
}

.btn-close:hover {
    opacity: 1;
    transform: rotate(90deg);
}

/* Modal fade animation */
.modal.fade .modal-dialog {
    transition: transform 0.3s ease-out;
    transform: translate(0, -50px);
}

.modal.show .modal-dialog {
    transform: translate(0, 0);
}
</style>