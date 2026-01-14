require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5830;
const TARGET_SERVICE = process.env.TARGET_SERVICE || 'http://localhost:8042';

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

// Authentication routes (our own API - don't proxy)
// Apply body parsing only to auth routes, not to proxy routes
app.use('/api/auth', express.json());
app.use('/api/auth', express.urlencoded({ extended: true }));
app.use('/api/auth', authRoutes);

// Proxy middleware configuration for Orthanc service
const proxyOptions = {
  target: TARGET_SERVICE,
  changeOrigin: true,
  pathRewrite: {},
  preserveHeaderKeyCase: true,
  onProxyReq: (proxyReq, req, res) => {
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${TARGET_SERVICE}${req.originalUrl}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} <- ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] Proxy error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Proxy error',
        message: err.message
      });
    }
  }
};

// Create proxy middleware
const proxy = createProxyMiddleware(proxyOptions);

// Proxy all other routes to Orthanc service (conditionally - only for Orthanc API routes)
// Routes that start with /api/ (except /api/auth) and other Orthanc routes will be proxied
app.use((req, res, next) => {
  // Don't proxy authentication routes
  if (req.path.startsWith('/api/auth')) {
    return next();
  }
  
  // Proxy all other routes to Orthanc service
  proxy(req, res, next);
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Proxying Orthanc requests to ${TARGET_SERVICE}`);
});
