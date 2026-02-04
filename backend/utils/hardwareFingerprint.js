/**
 * Hardware Fingerprint Module
 * Collects hardware identifiers and creates a unique fingerprint hash.
 * Used as encryption key for license/subscription data.
 */

const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');

// Cache the fingerprint in memory (computed once at startup)
let cachedFingerprint = null;

/**
 * Execute a shell command and return trimmed output
 * @param {string} command - Command to execute
 * @returns {string} - Command output or empty string on error
 */
function execCommand(command) {
  try {
    const output = execSync(command, { 
      encoding: 'utf8', 
      timeout: 10000,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output.trim();
  } catch (error) {
    return '';
  }
}

/**
 * Parse WMIC output to extract values (Windows)
 * WMIC outputs header + values, we want the values
 * @param {string} output - WMIC command output
 * @returns {string[]} - Array of non-empty values
 */
function parseWmicOutput(output) {
  if (!output) return [];
  const lines = output.split('\n')
    .map(line => line.trim())
    .filter(line => line && line.length > 0);
  // Skip header (first line)
  return lines.slice(1).filter(val => val && val !== 'None' && val !== 'To be filled by O.E.M.');
}

/**
 * Get CPU Processor ID
 */
async function getCpuId() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    const output = execCommand('wmic cpu get ProcessorId');
    return parseWmicOutput(output);
  } else if (platform === 'linux') {
    // Try to get CPU serial from /proc/cpuinfo
    const output = execCommand("cat /proc/cpuinfo | grep -i 'serial\\|model name' | head -5");
    if (output) {
      return output.split('\n').map(l => l.split(':')[1]?.trim()).filter(Boolean);
    }
  } else if (platform === 'darwin') {
    // macOS - get hardware UUID
    const output = execCommand('system_profiler SPHardwareDataType | grep "Hardware UUID"');
    if (output) {
      const match = output.match(/Hardware UUID:\s*(.+)/i);
      if (match) return [match[1].trim()];
    }
  }
  
  // Fallback to CPU info from os module
  const cpus = os.cpus();
  if (cpus.length > 0) {
    return [cpus[0].model];
  }
  return [];
}

/**
 * Get Motherboard Serial Number
 */
async function getMotherboardSerial() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    const output = execCommand('wmic baseboard get SerialNumber');
    return parseWmicOutput(output);
  } else if (platform === 'linux') {
    // Try DMI info
    const output = execCommand('cat /sys/class/dmi/id/board_serial 2>/dev/null || echo ""');
    if (output && output !== 'None') return [output];
    // Fallback
    const alt = execCommand('sudo dmidecode -s baseboard-serial-number 2>/dev/null || echo ""');
    if (alt && alt !== 'None') return [alt];
  } else if (platform === 'darwin') {
    const output = execCommand('system_profiler SPHardwareDataType | grep "Serial Number"');
    if (output) {
      const match = output.match(/Serial Number[^:]*:\s*(.+)/i);
      if (match) return [match[1].trim()];
    }
  }
  
  return [];
}

/**
 * Get BIOS Serial Number
 */
async function getBiosSerial() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    const output = execCommand('wmic bios get SerialNumber');
    return parseWmicOutput(output);
  } else if (platform === 'linux') {
    const output = execCommand('cat /sys/class/dmi/id/product_serial 2>/dev/null || echo ""');
    if (output && output !== 'None') return [output];
    const alt = execCommand('sudo dmidecode -s system-serial-number 2>/dev/null || echo ""');
    if (alt && alt !== 'None') return [alt];
  }
  
  return [];
}

/**
 * Get Disk Drive Serial Numbers
 */
async function getDiskSerials() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    const output = execCommand('wmic diskdrive get SerialNumber');
    return parseWmicOutput(output);
  } else if (platform === 'linux') {
    // Get disk serials using lsblk
    const output = execCommand('lsblk -d -o SERIAL 2>/dev/null | tail -n +2');
    if (output) {
      return output.split('\n').map(s => s.trim()).filter(Boolean);
    }
  } else if (platform === 'darwin') {
    const output = execCommand('system_profiler SPStorageDataType | grep "Serial Number"');
    if (output) {
      const serials = output.match(/Serial Number[^:]*:\s*(.+)/gi);
      if (serials) {
        return serials.map(s => s.split(':')[1]?.trim()).filter(Boolean);
      }
    }
  }
  
  return [];
}

/**
 * Get System UUID
 */
async function getSystemUuid() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    const output = execCommand('wmic csproduct get UUID');
    return parseWmicOutput(output);
  } else if (platform === 'linux') {
    const output = execCommand('cat /sys/class/dmi/id/product_uuid 2>/dev/null || echo ""');
    if (output && output !== 'None') return [output];
  } else if (platform === 'darwin') {
    const output = execCommand('system_profiler SPHardwareDataType | grep "Hardware UUID"');
    if (output) {
      const match = output.match(/Hardware UUID:\s*(.+)/i);
      if (match) return [match[1].trim()];
    }
  }
  
  return [];
}

/**
 * Get MAC Addresses (excluding virtual and loopback interfaces)
 */
function getMacAddresses() {
  const interfaces = os.networkInterfaces();
  const macs = [];
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    // Skip loopback and common virtual interfaces
    const lowerName = name.toLowerCase();
    if (lowerName === 'lo' || 
        lowerName.includes('loopback') ||
        lowerName.includes('virtual') ||
        lowerName.includes('vbox') ||
        lowerName.includes('vmware') ||
        lowerName.includes('docker') ||
        lowerName.includes('veth') ||
        lowerName.includes('br-')) {
      continue;
    }
    
    for (const addr of addrs) {
      if (addr.mac && addr.mac !== '00:00:00:00:00:00') {
        macs.push(addr.mac);
      }
    }
  }
  
  // Return unique MACs
  return [...new Set(macs)];
}

/**
 * Get OS Username
 */
function getOsUsername() {
  try {
    return os.userInfo().username;
  } catch {
    return process.env.USER || process.env.USERNAME || '';
  }
}

/**
 * Get Hostname
 */
function getHostname() {
  return os.hostname();
}

/**
 * Get Machine ID (Linux/macOS specific)
 */
async function getMachineId() {
  const platform = os.platform();
  
  if (platform === 'linux') {
    // Try common machine-id locations
    let output = execCommand('cat /etc/machine-id 2>/dev/null || echo ""');
    if (output) return [output];
    output = execCommand('cat /var/lib/dbus/machine-id 2>/dev/null || echo ""');
    if (output) return [output];
  }
  
  return [];
}

/**
 * Collect all hardware identifiers and generate a fingerprint hash
 * @returns {Promise<string>} - SHA-256 hash of combined hardware identifiers
 */
async function generateHardwareFingerprint() {
  console.log('[HardwareFingerprint] Collecting hardware identifiers...');
  
  // Collect all hardware components in parallel
  const [
    cpuId,
    motherboardSerial,
    biosSerial,
    diskSerials,
    systemUuid,
    machineId
  ] = await Promise.all([
    getCpuId(),
    getMotherboardSerial(),
    getBiosSerial(),
    getDiskSerials(),
    getSystemUuid(),
    getMachineId()
  ]);
  
  // Get synchronous values
  const macAddresses = getMacAddresses();
  const username = getOsUsername();
  const hostname = getHostname();
  const platform = os.platform();
  const arch = os.arch();
  
  // Combine all components
  const components = [
    ...cpuId,
    ...motherboardSerial,
    ...biosSerial,
    ...diskSerials,
    ...systemUuid,
    ...machineId,
    ...macAddresses,
    username,
    hostname,
    platform,
    arch
  ];
  
  // Filter out empty values, sort for consistency
  const validComponents = components
    .filter(c => c && typeof c === 'string' && c.trim().length > 0)
    .map(c => c.trim().toLowerCase())
    .sort();
  
  // Log collected components (for debugging, remove in production)
  console.log('[HardwareFingerprint] Components collected:', validComponents.length);
  
  if (validComponents.length < 3) {
    console.warn('[HardwareFingerprint] Warning: Only', validComponents.length, 'hardware identifiers found. Fingerprint may not be unique enough.');
  }
  
  // Combine and hash
  const combined = validComponents.join('|');
  const fingerprint = crypto.createHash('sha256').update(combined).digest('hex');
  
  console.log('[HardwareFingerprint] Fingerprint generated:', fingerprint.substring(0, 16) + '...');
  
  return fingerprint;
}

/**
 * Get the hardware fingerprint (cached after first call)
 * @returns {Promise<string>} - Hardware fingerprint hash
 */
async function getFingerprint() {
  if (!cachedFingerprint) {
    cachedFingerprint = await generateHardwareFingerprint();
  }
  return cachedFingerprint;
}

/**
 * Clear the cached fingerprint (useful for testing)
 */
function clearCache() {
  cachedFingerprint = null;
}

/**
 * Get detailed hardware info (for debugging)
 * @returns {Promise<object>} - Object with all collected hardware identifiers
 */
async function getHardwareDetails() {
  const [
    cpuId,
    motherboardSerial,
    biosSerial,
    diskSerials,
    systemUuid,
    machineId
  ] = await Promise.all([
    getCpuId(),
    getMotherboardSerial(),
    getBiosSerial(),
    getDiskSerials(),
    getSystemUuid(),
    getMachineId()
  ]);
  
  return {
    cpuId,
    motherboardSerial,
    biosSerial,
    diskSerials,
    systemUuid,
    machineId,
    macAddresses: getMacAddresses(),
    username: getOsUsername(),
    hostname: getHostname(),
    platform: os.platform(),
    arch: os.arch()
  };
}

module.exports = {
  getFingerprint,
  generateHardwareFingerprint,
  getHardwareDetails,
  clearCache
};
