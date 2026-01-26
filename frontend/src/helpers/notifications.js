/**
 * Centralized notification messages for access control
 */

export const NotificationMessages = {
  // Doctor without membership
  DOCTOR_NO_MEMBERSHIP: "You can't use this before join the hospital. Please join a hospital first.",
  
  // Admin with expired/no subscription
  ADMIN_NO_SUBSCRIPTION: "Contact the owner to set up your hospital subscription.",
  ADMIN_EXPIRED_SUBSCRIPTION: "Contact the owner to extend the subscription.",
  
  // Doctor with expired hospital subscription
  DOCTOR_HOSPITAL_SUSPENDED: "Hospital is currently suspended, wait for the administrator to renew.",
  
  // Expiration warnings
  EXPIRATION_WARNING: (days) => `There are ${days} days left until the deadline. Please contact the administrator to extend the deadline.`,
  
  // Generic access denied
  ACCESS_DENIED: "Access denied. You don't have permission to access this feature."
};

/**
 * Show notification using the message bus
 * @param {Object} messageBus - Vue message bus instance
 * @param {String} message - Message to display
 * @param {String} type - Notification type: 'info', 'error', 'warning', 'success'
 */
export function showNotification(messageBus, message, type = 'info') {
  if (messageBus && typeof messageBus.emit === 'function') {
    const eventName = type === 'error' ? 'show-error-toast' 
                    : type === 'success' ? 'show-success-toast'
                    : type === 'warning' ? 'show-info-toast'
                    : 'show-info-toast';
    messageBus.emit(eventName, message);
  } else {
    console.warn('Message bus not available, notification not shown:', message);
  }
}

/**
 * Show access denied notification based on user role and access state
 * @param {Object} messageBus - Vue message bus instance
 * @param {String} userRole - User role: 'doctor', 'admin', 'owner'
 * @param {Object} accessState - Access state object with membership/subscription info
 */
export function showAccessDeniedNotification(messageBus, userRole, accessState) {
  let message = NotificationMessages.ACCESS_DENIED;
  
  if (userRole === 'doctor') {
    if (!accessState.hasMembership) {
      message = NotificationMessages.DOCTOR_NO_MEMBERSHIP;
    } else if (!accessState.hasActiveSubscription) {
      message = NotificationMessages.DOCTOR_HOSPITAL_SUSPENDED;
    }
  } else if (userRole === 'admin') {
    if (!accessState.hasSubscription) {
      message = NotificationMessages.ADMIN_NO_SUBSCRIPTION;
    } else if (!accessState.hasActiveSubscription) {
      message = NotificationMessages.ADMIN_EXPIRED_SUBSCRIPTION;
    }
  }
  
  showNotification(messageBus, message, 'error');
}

export default {
  NotificationMessages,
  showNotification,
  showAccessDeniedNotification
};
