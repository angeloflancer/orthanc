/**
 * Subscription Service
 * Centralized service for all subscription operations with hardware-bound encryption.
 * All subscription data is encrypted using the hardware fingerprint.
 */

const HospitalSubscription = require('../models/HospitalSubscription');
const { getFingerprint } = require('./hardwareFingerprint');
const { encryptSubscription, decryptSubscription } = require('./licenseEncryption');

/**
 * Default expired subscription result (returned when decryption fails)
 */
const EXPIRED_RESULT = {
  planType: 'monthly',
  expiresAt: new Date(0), // Epoch = definitely expired
  isActive: false,
  daysUntilExpiration: 0,
  shouldShowWarning: false,
  decryptionFailed: true
};

/**
 * Calculate if subscription is active based on planType and expiresAt
 * @param {string} planType 
 * @param {Date|null} expiresAt 
 * @returns {boolean}
 */
function calculateIsActive(planType, expiresAt) {
  if (planType === 'forever') {
    return true;
  }
  if (!expiresAt) {
    return true; // If no expiration set, consider active
  }
  return expiresAt > new Date();
}

/**
 * Calculate days until expiration
 * @param {string} planType 
 * @param {Date|null} expiresAt 
 * @returns {number|null}
 */
function calculateDaysUntilExpiration(planType, expiresAt) {
  if (planType === 'forever' || !expiresAt) {
    return null;
  }
  const now = new Date();
  const diffTime = expiresAt - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Check if warning should be shown (≤3 days until expiration)
 * @param {string} planType 
 * @param {Date|null} expiresAt 
 * @returns {boolean}
 */
function calculateShouldShowWarning(planType, expiresAt) {
  if (planType === 'forever' || !expiresAt) {
    return false;
  }
  const daysUntil = calculateDaysUntilExpiration(planType, expiresAt);
  return daysUntil !== null && daysUntil <= 3 && daysUntil >= 0;
}

/**
 * Build a subscription info object from decrypted data
 * @param {object} decrypted - Decrypted subscription data
 * @param {object} doc - MongoDB document (for metadata)
 * @returns {object}
 */
function buildSubscriptionInfo(decrypted, doc = {}) {
  const { planType, expiresAt } = decrypted;
  
  return {
    id: doc._id || null,
    planType,
    expiresAt,
    isActive: calculateIsActive(planType, expiresAt),
    daysUntilExpiration: calculateDaysUntilExpiration(planType, expiresAt),
    shouldShowWarning: calculateShouldShowWarning(planType, expiresAt),
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
    decryptionFailed: false
  };
}

/**
 * Save a subscription (encrypt before storing)
 * @param {string|ObjectId} hospitalId - Hospital ID (can be string or ObjectId)
 * @param {string} planType - 'monthly', 'yearly', or 'forever'
 * @param {Date|null} expiresAt - Expiration date (null for forever)
 * @returns {Promise<object>} - Saved subscription info
 */
async function saveSubscription(hospitalId, planType, expiresAt = null) {
  const fingerprint = await getFingerprint();
  
  // Encrypt the subscription data
  const encryptedPayload = encryptSubscription(planType, expiresAt, fingerprint);
  
  // Find existing or create new
  let subscription = await HospitalSubscription.findOne({ hospital: hospitalId });
  
  if (subscription) {
    // Update existing
    subscription.encryptedPayload = encryptedPayload;
    // Keep legacy fields for migration detection, but they won't be trusted
    subscription.planType = planType;
    subscription.expiresAt = expiresAt;
    await subscription.save();
  } else {
    // Create new
    subscription = await HospitalSubscription.create({
      hospital: hospitalId,
      encryptedPayload,
      planType, // Legacy field
      expiresAt // Legacy field
    });
  }
  
  return buildSubscriptionInfo({ planType, expiresAt }, subscription);
}

/**
 * Load a subscription (decrypt after fetching)
 * Returns expired result if decryption fails (hardware mismatch)
 * @param {string|ObjectId} hospitalId - Hospital ID
 * @returns {Promise<object|null>} - Subscription info or null if not found
 */
async function loadSubscription(hospitalId) {
  const subscription = await HospitalSubscription.findOne({ hospital: hospitalId });
  
  if (!subscription) {
    return null;
  }
  
  // Check if this is encrypted (new format)
  if (subscription.encryptedPayload) {
    const fingerprint = await getFingerprint();
    const decrypted = decryptSubscription(subscription.encryptedPayload, fingerprint);
    
    if (decrypted) {
      // Decryption successful
      return buildSubscriptionInfo(decrypted, subscription);
    } else {
      // Decryption failed - hardware mismatch
      console.warn(`[SubscriptionService] Decryption failed for hospital ${hospitalId} - treating as expired`);
      return {
        ...EXPIRED_RESULT,
        id: subscription._id,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      };
    }
  }
  
  // Old format (unencrypted) - treat as expired
  // This forces re-subscription after migration
  console.warn(`[SubscriptionService] Unencrypted subscription found for hospital ${hospitalId} - treating as expired`);
  return {
    ...EXPIRED_RESULT,
    id: subscription._id,
    planType: subscription.planType || 'monthly',
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt
  };
}

/**
 * Check if a hospital has an active subscription
 * @param {string|ObjectId} hospitalId - Hospital ID
 * @returns {Promise<boolean>}
 */
async function isSubscriptionActive(hospitalId) {
  const subscription = await loadSubscription(hospitalId);
  return subscription ? subscription.isActive : false;
}

/**
 * Get subscription info formatted for API response
 * @param {string|ObjectId} hospitalId - Hospital ID
 * @returns {Promise<object|null>}
 */
async function getSubscriptionForApi(hospitalId) {
  const subscription = await loadSubscription(hospitalId);
  
  if (!subscription) {
    return null;
  }
  
  // Return only the fields needed by the API
  return {
    planType: subscription.planType,
    expiresAt: subscription.expiresAt,
    isActive: subscription.isActive,
    daysUntilExpiration: subscription.daysUntilExpiration,
    shouldShowWarning: subscription.shouldShowWarning
  };
}

/**
 * Expire a subscription (set expiration to past date)
 * @param {string|ObjectId} hospitalId - Hospital ID
 * @returns {Promise<object|null>} - Updated subscription info or null
 */
async function expireSubscription(hospitalId) {
  const subscription = await loadSubscription(hospitalId);
  
  if (!subscription) {
    return null;
  }
  
  // Set expiration to yesterday
  const expiredDate = new Date();
  expiredDate.setDate(expiredDate.getDate() - 1);
  
  return await saveSubscription(hospitalId, subscription.planType, expiredDate);
}

/**
 * Delete a subscription
 * @param {string|ObjectId} hospitalId - Hospital ID
 * @returns {Promise<boolean>} - True if deleted
 */
async function deleteSubscription(hospitalId) {
  const result = await HospitalSubscription.deleteOne({ hospital: hospitalId });
  return result.deletedCount > 0;
}

/**
 * Migrate old unencrypted subscriptions to encrypted format (as expired)
 * Should be called at server startup
 * @returns {Promise<number>} - Number of subscriptions migrated
 */
async function migrateOldSubscriptions() {
  console.log('[SubscriptionService] Checking for unencrypted subscriptions to migrate...');
  
  // Find subscriptions without encryptedPayload
  const oldSubs = await HospitalSubscription.find({ 
    encryptedPayload: { $exists: false } 
  });
  
  if (oldSubs.length === 0) {
    console.log('[SubscriptionService] No unencrypted subscriptions found.');
    return 0;
  }
  
  console.log(`[SubscriptionService] Found ${oldSubs.length} unencrypted subscription(s). Migrating as expired...`);
  
  const fingerprint = await getFingerprint();
  let migrated = 0;
  
  for (const sub of oldSubs) {
    try {
      // Encrypt with expired date (epoch = Jan 1, 1970)
      const encryptedPayload = encryptSubscription(
        sub.planType || 'monthly',
        new Date(0), // Expired
        fingerprint
      );
      
      sub.encryptedPayload = encryptedPayload;
      await sub.save();
      migrated++;
      
      console.log(`[SubscriptionService] Migrated subscription for hospital ${sub.hospital}`);
    } catch (error) {
      console.error(`[SubscriptionService] Failed to migrate subscription ${sub._id}:`, error.message);
    }
  }
  
  console.log(`[SubscriptionService] Migration complete. ${migrated}/${oldSubs.length} subscriptions migrated.`);
  return migrated;
}

/**
 * Get raw subscription document (for debugging)
 * @param {string|ObjectId} hospitalId 
 * @returns {Promise<object|null>}
 */
async function getRawSubscription(hospitalId) {
  return await HospitalSubscription.findOne({ hospital: hospitalId }).lean();
}

module.exports = {
  saveSubscription,
  loadSubscription,
  isSubscriptionActive,
  getSubscriptionForApi,
  expireSubscription,
  deleteSubscription,
  migrateOldSubscriptions,
  getRawSubscription,
  // Export helpers for testing
  calculateIsActive,
  calculateDaysUntilExpiration,
  calculateShouldShowWarning
};
