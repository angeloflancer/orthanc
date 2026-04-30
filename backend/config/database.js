const mongoose = require('mongoose');

// Use IPv4 127.0.0.1 instead of localhost so we don't get ECONNREFUSED ::1 (case-insensitive)
function normalizeMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return uri;
  return uri
    .replace(/\/\/localhost:/gi, '//127.0.0.1:')
    .replace(/@localhost:/gi, '@127.0.0.1:')
    .replace(/\/\/localhost\//gi, '//127.0.0.1/')
    .replace(/@localhost\//gi, '@127.0.0.1/');
}

const connectDB = async () => {
  const rawUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orthanc';
  const primaryUri = normalizeMongoUri(rawUri);
  const fallbackUris = [
    'mongodb://127.0.0.1:27017/emedx',
    'mongodb://127.0.0.1:27017/orthanc'
  ];
  const connectionCandidates = [primaryUri, ...fallbackUris.filter((u) => u !== primaryUri)];

  let lastError = null;

  for (const uri of connectionCandidates) {
    try {
      const conn = await mongoose.connect(uri);
      if (uri !== primaryUri) {
        console.warn(`MongoDB auth failed for configured URI, using fallback: ${uri}`);
      }
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  console.error(`Error: ${lastError ? lastError.message : 'Unable to connect to MongoDB'}`);
  process.exit(1);
};

module.exports = connectDB;
