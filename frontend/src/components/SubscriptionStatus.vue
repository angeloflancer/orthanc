<template>
  <div class="subscription-status-card">
    <div class="card shadow-sm">
      <div class="card-body">
        <div class="subscription-header">
          <h5 class="card-title mb-0">
            <i class="bi bi-calendar-check me-2"></i>Subscription Status
          </h5>
        </div>
        
        <div v-if="loading" class="text-center py-3">
          <div class="spinner-border spinner-border-sm text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        
        <div v-else-if="subscription" class="subscription-content">
          <!-- Plan Type Badge -->
          <div class="plan-badge-container mb-3">
            <span class="plan-badge" :class="getPlanBadgeClass()">
              <i :class="getPlanIcon()" class="me-1"></i>
              {{ getPlanName() }}
            </span>
          </div>
          
          <!-- Expiration Info -->
          <div v-if="subscription.planType !== 'forever'" class="expiration-info">
            <div class="expiration-row">
              <span class="expiration-label">
                <i class="bi bi-clock me-1"></i>Expires:
              </span>
              <span class="expiration-value">
                {{ formatDate(subscription.expiresAt) }}
              </span>
            </div>
            
            <div class="expiration-row mt-2">
              <span class="expiration-label">
                <i class="bi bi-calendar-x me-1"></i>Days Remaining:
              </span>
              <span class="expiration-value" :class="getDaysRemainingClass()">
                {{ subscription.daysUntilExpiration !== null ? subscription.daysUntilExpiration : 'N/A' }}
              </span>
            </div>
            
            <!-- Progress Bar -->
            <div v-if="subscription.daysUntilExpiration !== null && subscription.daysUntilExpiration >= 0" class="progress-container mt-3">
              <div class="progress" style="height: 8px;">
                <div 
                  class="progress-bar" 
                  :class="getProgressBarClass()"
                  :style="{ width: getProgressPercentage() + '%' }"
                  role="progressbar"
                ></div>
              </div>
            </div>
          </div>
          
          <!-- Forever Plan Message -->
          <div v-else class="forever-plan-message">
            <i class="bi bi-infinity me-2"></i>
            <span>Unlimited access - No expiration</span>
          </div>
          
          <!-- Warning Banner -->
          <div v-if="subscription.shouldShowWarning" class="warning-banner mt-3">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <span>There are {{ subscription.daysUntilExpiration }} days left until the deadline. Please contact the administrator to extend the deadline.</span>
          </div>
          
          <!-- Expired Banner -->
          <div v-if="!subscription.isActive && subscription.planType !== 'forever'" class="expired-banner mt-3">
            <i class="bi bi-x-circle-fill me-2"></i>
            <span>Subscription has expired. Contact the owner to renew.</span>
          </div>
        </div>
        
        <div v-else class="no-subscription">
          <i class="bi bi-info-circle me-2"></i>
          <span>No subscription found. Please contact the owner.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { orthancApiUrl } from '../globalConfigurations';

export default {
  name: 'SubscriptionStatus',
  data() {
    return {
      subscription: null,
      loading: true
    };
  },
  async mounted() {
    await this.loadSubscription();
  },
  methods: {
    async loadSubscription() {
      try {
        this.loading = true;
        const token = localStorage.getItem('auth-token');
        if (!token) return;
        
        const response = await axios.get(`${orthancApiUrl}api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data.success && response.data.user) {
          if (response.data.user.role === 'admin' && response.data.user.subscription) {
            this.subscription = response.data.user.subscription;
          }
        }
      } catch (error) {
        console.error('Error loading subscription:', error);
      } finally {
        this.loading = false;
      }
    },
    getPlanName() {
      if (!this.subscription) return '';
      const planNames = {
        monthly: 'Monthly Plan',
        yearly: 'Yearly Plan',
        forever: 'Forever Plan'
      };
      return planNames[this.subscription.planType] || this.subscription.planType;
    },
    getPlanIcon() {
      if (!this.subscription) return 'bi bi-calendar';
      const icons = {
        monthly: 'bi bi-calendar-month',
        yearly: 'bi bi-calendar-year',
        forever: 'bi bi-infinity'
      };
      return icons[this.subscription.planType] || 'bi bi-calendar';
    },
    getPlanBadgeClass() {
      if (!this.subscription) return 'plan-badge-default';
      if (this.subscription.planType === 'forever') return 'plan-badge-forever';
      if (this.subscription.isActive) return 'plan-badge-active';
      return 'plan-badge-expired';
    },
    formatDate(dateString) {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    },
    getDaysRemainingClass() {
      if (!this.subscription || this.subscription.daysUntilExpiration === null) return '';
      const days = this.subscription.daysUntilExpiration;
      if (days <= 0) return 'days-expired';
      if (days <= 3) return 'days-warning';
      if (days <= 7) return 'days-caution';
      return 'days-ok';
    },
    getProgressPercentage() {
      if (!this.subscription || this.subscription.planType === 'forever') return 100;
      if (this.subscription.daysUntilExpiration === null) return 0;
      
      const totalDays = this.subscription.planType === 'monthly' ? 30 : 365;
      const remaining = this.subscription.daysUntilExpiration;
      const percentage = (remaining / totalDays) * 100;
      return Math.max(0, Math.min(100, percentage));
    },
    getProgressBarClass() {
      if (!this.subscription) return 'bg-secondary';
      if (!this.subscription.isActive) return 'bg-danger';
      if (this.subscription.shouldShowWarning) return 'bg-warning';
      if (this.subscription.daysUntilExpiration !== null && this.subscription.daysUntilExpiration <= 7) return 'bg-warning';
      return 'bg-success';
    }
  }
};
</script>

<style scoped>
.subscription-status-card {
  margin-bottom: 24px;
}

.subscription-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  display: flex;
  align-items: center;
}

.subscription-content {
  padding: 8px 0;
}

.plan-badge-container {
  display: flex;
  align-items: center;
}

.plan-badge {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.plan-badge-active {
  background: #dbeafe;
  color: #1e40af;
}

.plan-badge-forever {
  background: #f0fdf4;
  color: #166534;
}

.plan-badge-expired {
  background: #fee2e2;
  color: #991b1b;
}

.plan-badge-default {
  background: #f3f4f6;
  color: #6b7280;
}

.expiration-info {
  margin-top: 16px;
}

.expiration-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.expiration-label {
  color: #6b7280;
  display: flex;
  align-items: center;
}

.expiration-value {
  font-weight: 600;
  color: #111827;
}

.days-ok {
  color: #059669;
}

.days-caution {
  color: #d97706;
}

.days-warning {
  color: #dc2626;
}

.days-expired {
  color: #991b1b;
}

.progress-container {
  margin-top: 12px;
}

.progress {
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  transition: width 0.3s ease;
}

.forever-plan-message {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  color: #166534;
  font-size: 14px;
  font-weight: 500;
}

.warning-banner {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  color: #92400e;
  font-size: 14px;
  line-height: 1.5;
}

.warning-banner i {
  flex-shrink: 0;
  margin-top: 2px;
}

.expired-banner {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
  font-size: 14px;
  line-height: 1.5;
}

.expired-banner i {
  flex-shrink: 0;
  margin-top: 2px;
}

.no-subscription {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #6b7280;
  font-size: 14px;
}
</style>
