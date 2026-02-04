/**
 * License Encryption Module
 * Provides AES-256-GCM encryption/decryption using hardware fingerprint as key.
 * Used to protect subscription data so it's bound to specific hardware.
 */

const crypto = require('crypto');

// Constants for encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;        // 128 bits for GCM
const AUTH_TAG_LENGTH = 16;  // 128 bits authentication tag
const KEY_LENGTH = 32;       // 256 bits for AES-256
const SALT = 'EMEDX-LICENSE-PROTECTION-SALT-v1'; // Static salt for key derivation
const ITERATIONS = 100000;   // PBKDF2 iterations

/**
 * Derive an AES-256 key from the hardware fingerprint using PBKDF2
 * @param {string} fingerprint - Hardware fingerprint hash
 * @returns {Buffer} - 32-byte encryption key
 */
function deriveKey(fingerprint) {
  return crypto.pbkdf2Sync(
    fingerprint,
    SALT,
    ITERATIONS,
    KEY_LENGTH,
    'sha256'
  );
}

/**
 * Encrypt data using hardware fingerprint as key
 * @param {object|string} data - Data to encrypt (will be JSON stringified if object)
 * @param {string} fingerprint - Hardware fingerprint to use as encryption key
 * @returns {string} - Base64 encoded encrypted data (IV + ciphertext + authTag)
 */
function encrypt(data, fingerprint) {
  if (!data) {
    throw new Error('No data provided for encryption');
  }
  if (!fingerprint) {
    throw new Error('No fingerprint provided for encryption');
  }
  
  // Convert data to string if it's an object
  const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
  
  // Derive encryption key from fingerprint
  const key = deriveKey(fingerprint);
  
  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  
  // Encrypt the data
  const encrypted = Buffer.concat([
    cipher.update(dataStr, 'utf8'),
    cipher.final()
  ]);
  
  // Get authentication tag
  const authTag = cipher.getAuthTag();
  
  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  
  // Return as base64
  return combined.toString('base64');
}

/**
 * Decrypt data using hardware fingerprint as key
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} fingerprint - Hardware fingerprint to use as decryption key
 * @returns {object|null} - Decrypted data (parsed as JSON) or null if decryption fails
 */
function decrypt(encryptedData, fingerprint) {
  if (!encryptedData) {
    return null;
  }
  if (!fingerprint) {
    return null;
  }
  
  try {
    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Minimum size check: IV + at least 1 byte + auth tag
    if (combined.length < IV_LENGTH + 1 + AUTH_TAG_LENGTH) {
      console.error('[LicenseEncryption] Invalid encrypted data length');
      return null;
    }
    
    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);
    
    // Derive decryption key from fingerprint
    const key = deriveKey(fingerprint);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // Set auth tag
    decipher.setAuthTag(authTag);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    // Parse JSON
    const dataStr = decrypted.toString('utf8');
    
    try {
      return JSON.parse(dataStr);
    } catch {
      // If not valid JSON, return as string
      return dataStr;
    }
  } catch (error) {
    // Decryption failed - likely wrong fingerprint (different hardware)
    console.error('[LicenseEncryption] Decryption failed:', error.message);
    return null;
  }
}

/**
 * Verify if data can be decrypted with the given fingerprint
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} fingerprint - Hardware fingerprint to test
 * @returns {boolean} - True if decryption succeeds
 */
function canDecrypt(encryptedData, fingerprint) {
  return decrypt(encryptedData, fingerprint) !== null;
}

/**
 * Create an encrypted subscription payload
 * @param {string} planType - 'monthly', 'yearly', or 'forever'
 * @param {Date|null} expiresAt - Expiration date or null for forever plans
 * @param {string} fingerprint - Hardware fingerprint
 * @returns {string} - Encrypted payload
 */
function encryptSubscription(planType, expiresAt, fingerprint) {
  const payload = {
    planType,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    encryptedAt: new Date().toISOString(),
    version: 1
  };
  return encrypt(payload, fingerprint);
}

/**
 * Decrypt a subscription payload
 * @param {string} encryptedPayload - Encrypted subscription data
 * @param {string} fingerprint - Hardware fingerprint
 * @returns {object|null} - Decrypted subscription data or null if failed
 */
function decryptSubscription(encryptedPayload, fingerprint) {
  const data = decrypt(encryptedPayload, fingerprint);
  
  if (!data) {
    return null;
  }
  
  // Parse dates back to Date objects
  return {
    planType: data.planType,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    encryptedAt: data.encryptedAt ? new Date(data.encryptedAt) : null,
    version: data.version || 1
  };
}

module.exports = {
  encrypt,
  decrypt,
  canDecrypt,
  encryptSubscription,
  decryptSubscription
};
