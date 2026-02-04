---
name: UI Modernization Plan
overview: Comprehensive modernization of 6 pages and 10+ dialogs to achieve a consistent "modern and heavy" design language, matching the recently updated DICOM study page styling.
todos:
  - id: modal-base
    content: "Update Modal.vue primary colors to #4a90e2"
    status: completed
  - id: dashboard
    content: Modernize Dashboard.vue - cards, stats, actions
    status: completed
  - id: account-settings
    content: Modernize AccountSettings.vue - forms, cards, badges
    status: completed
  - id: user-management
    content: Modernize UserManagement.vue - table, modals, badges
    status: completed
  - id: hospital-management
    content: Modernize HospitalManagement.vue - cards, all 5 modals
    status: completed
  - id: member-management
    content: Modernize MemberManagement.vue - table, invite modal
    status: completed
  - id: verify-email
    content: Modernize VerifyEmail.vue and hide sidebar
    status: completed
  - id: upload-dialogs
    content: Modernize UploadHandler.vue and UploadReport.vue modals
    status: completed
  - id: hospital-settings
    content: Modernize HospitalSettings.vue modals
    status: completed
  - id: other-modals
    content: Update ConfirmDialog, ShareModal, ModifyModal
    status: completed
isProject: false
---

# Comprehensive UI Modernization Plan

## Design Principles (Consistent with DICOM Study Page)

Based on the recently completed DICOM study page styling, apply these principles:

- **No gradients** - Use solid background colors
- **Heavy shadows** - `box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08)`
- **Modern typography** - System fonts, uppercase headers with letter-spacing
- **Primary color** - `#4a90e2` (light blue)
- **Clean borders** - `#e5e7eb` with 1-2px solid
- **Rounded corners** - 12px for cards, 8px for buttons/inputs
- **Solid hover states** - Simple background color changes, no gradients

---

## Phase 1: Base Modal Component Enhancement

Update [frontend/src/components/Modal.vue](frontend/src/components/Modal.vue) to use the project's primary blue color and ensure consistency.

**Changes:**

- Update `.btn-primary` from `#2563eb` to `#4a90e2`
- Add hover state `#357abd`
- This will affect all Bootstrap modals application-wide

---

## Phase 2: Dashboard Page

File: [frontend/src/components/Dashboard.vue](frontend/src/components/Dashboard.vue)

**Key changes:**

- Remove gradient backgrounds from stat cards
- Modernize card shadows and borders
- Update typography to match heavy style
- Simplify hover effects (solid colors only)
- Update color palette to use `#4a90e2`

---

## Phase 3: Account Settings Page

File: [frontend/src/components/AccountSettings.vue](frontend/src/components/AccountSettings.vue)

**Key changes:**

- Modernize form sections with card styling
- Update input styles (solid borders, clean focus states)
- Simplify button animations (remove complex gradients)
- Update verification status badges
- Modernize hospital membership cards
- Update subscription status display

---

## Phase 4: User Management Page (Owner Role)

File: [frontend/src/components/UserManagement.vue](frontend/src/components/UserManagement.vue)

**Key changes:**

- Modernize table header (solid background, uppercase text)
- Update filter buttons (solid colors, simple hover)
- Simplify expanded row styling
- Update status badges
- Modernize pagination controls
- Update block/unblock modals

---

## Phase 5: Hospital Management Page (Owner Role)

File: [frontend/src/components/HospitalManagement.vue](frontend/src/components/HospitalManagement.vue)

**Key changes:**

- Update hospital cards (solid backgrounds, heavy shadows)
- Modernize all embedded modals:
  - Subscribe/Extend subscription modal
  - Create hospital modal
  - Change admin modal
  - Add/Invite doctor modal
  - Confirm action modal (delete/kick/block)
- Update status badges and action buttons

---

## Phase 6: Hospital Members Page (Admin Role)

File: [frontend/src/components/MemberManagement.vue](frontend/src/components/MemberManagement.vue)

**Key changes:**

- Modernize table styling (match Study table pattern)
- Update filter buttons
- Modernize invite doctor modal
- Update status badges
- Improve search dropdown styling

---

## Phase 7: Verification Success Page

File: [frontend/src/components/VerifyEmail.vue](frontend/src/components/VerifyEmail.vue)

**Key changes:**

- Hide sidebar when this page is shown (update router or component)
- Modernize centered card styling
- Update success/error alert styling
- Simplify button styling

**Sidebar hiding approach:**

- Add route meta `{ hideSidebar: true }` in [frontend/src/router.js](frontend/src/router.js)
- Update [frontend/src/App.vue](frontend/src/App.vue) to check route meta

---

## Phase 8: Upload and Document Dialogs

Files to update:

- [frontend/src/components/UploadHandler.vue](frontend/src/components/UploadHandler.vue) - Patient ID/Name input modal
- [frontend/src/components/UploadReport.vue](frontend/src/components/UploadReport.vue) - Upload progress modal

**Key changes:**

- Standardize modal styling with `.hm-modal` pattern
- Update input fields and buttons
- Modernize progress indicators

---

## Phase 9: Hospital Settings Dialogs (Admin)

File: [frontend/src/components/HospitalSettings.vue](frontend/src/components/HospitalSettings.vue)

**Key changes:**

- Modernize edit hospital modal
- Update delete hospital confirmation modal
- Ensure consistency with HospitalManagement modals

---

## Phase 10: Other Modals

Update remaining modals for consistency:

- [frontend/src/components/ConfirmDialog.vue](frontend/src/components/ConfirmDialog.vue)
- [frontend/src/components/ShareModal.vue](frontend/src/components/ShareModal.vue)
- [frontend/src/components/ModifyModal.vue](frontend/src/components/ModifyModal.vue)

---

## Standard Modal CSS Pattern

Apply this consistent pattern to all custom Vue-controlled modals:

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 20px;
}

.modal-container {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #374151;
  margin: 0;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Standard button styles */
.btn-modern {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.15s ease;
  border: none;
  cursor: pointer;
}

.btn-primary-modern {
  background: #4a90e2;
  color: white;
}

.btn-primary-modern:hover {
  background: #357abd;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 144, 226, 0.25);
}

.btn-secondary-modern {
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary-modern:hover {
  background: #e8f4fd;
  color: #4a90e2;
}
```

---

## Estimated Scope

- **Total files**: ~15 components
- **Style updates**: ~8,000+ lines
- **New patterns**: Reusable modal CSS, button styles, card styles
- **Router update**: Add hideSidebar meta for VerifyEmail

