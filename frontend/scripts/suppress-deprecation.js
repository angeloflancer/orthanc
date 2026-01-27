// Suppress Node.js deprecation warnings from dependencies
// This file is loaded before vite starts to suppress util._extend warnings
// Using CommonJS format since -r flag loads it as CommonJS

if (typeof process !== 'undefined') {
  // Suppress DEP0060 warnings about util._extend
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function(warning, type, code, ctor) {
    if (code === 'DEP0060' || 
        (typeof warning === 'string' && warning.includes('util._extend')) ||
        (warning && warning.toString && warning.toString().includes('util._extend'))) {
      return;
    }
    // Call original for other warnings
    if (originalEmitWarning) {
      return originalEmitWarning.call(this, warning, type, code, ctor);
    }
  };
  
  // Also handle process.on('warning') events
  process.removeAllListeners('warning');
  process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning' && 
        (warning.code === 'DEP0060' || warning.message.includes('util._extend'))) {
      return; // Suppress this warning
    }
    // Log other warnings
    console.warn(warning.name, warning.message);
  });
}
