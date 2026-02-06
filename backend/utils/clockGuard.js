/**
 * Clock guard: detect system clock set backward (e.g. to extend subscription).
 * Uses a high-water mark (lastSeenTime) in MongoDB. If current time is earlier
 * than lastSeenTime minus tolerance, we set clockTamperedAt and treat all
 * subscriptions as expired.
 */

const LicenseGuard = require('../models/LicenseGuard');

const DOC_ID = 'clock';
const TOLERANCE_MS = 60 * 1000; // 60 seconds - allow small skew

/**
 * Check if the system clock is valid (not set backward).
 * - If clockTamperedAt is already set, returns { valid: false }.
 * - If current time < lastSeenTime - TOLERANCE, sets clockTamperedAt and returns { valid: false }.
 * - Otherwise updates lastSeenTime (throttled) and returns { valid: true }.
 * @returns {Promise<{ valid: boolean }>}
 */
async function check() {
  const now = new Date();
  const nowMs = now.getTime();

  let doc = await LicenseGuard.findById(DOC_ID);

  if (!doc) {
    doc = await LicenseGuard.create({
      _id: DOC_ID,
      lastSeenTime: now,
      clockTamperedAt: null
    });
    return { valid: true };
  }

  if (doc.clockTamperedAt) {
    return { valid: false };
  }

  const lastSeenMs = doc.lastSeenTime.getTime();
  const threshold = lastSeenMs - TOLERANCE_MS;

  if (nowMs < threshold) {
    doc.clockTamperedAt = now;
    await doc.save();
    console.warn('[ClockGuard] System clock set backward detected. All hospital subscriptions are now treated as expired.');
    return { valid: false };
  }

  if (nowMs > lastSeenMs) {
    doc.lastSeenTime = now;
    await doc.save();
  }

  return { valid: true };
}

module.exports = {
  check
};
