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
  try {
    const rawUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orthanc';
    const uri = normalizeMongoUri(rawUri);
    const conn = await mongoose.connect(uri);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
