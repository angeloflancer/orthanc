const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 5830;
const TARGET_SERVICE = 'http://localhost:8042';

// Enable CORS for all routes
app.use(cors({
  origin: true,
  credentials: true
}));

// Proxy middleware configuration
// Note: We don't parse JSON/URL-encoded bodies here because http-proxy-middleware
// handles the request body streaming automatically, which is important for file uploads
const proxyOptions = {
  target: TARGET_SERVICE,
  changeOrigin: true,
  // Don't rewrite paths - forward as-is
  pathRewrite: {},
  // Preserve the original host header
  preserveHeaderKeyCase: true,
  // Handle all HTTP methods
  onProxyReq: (proxyReq, req, res) => {
    // Log the proxy request for debugging
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${TARGET_SERVICE}${req.originalUrl}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log the response for debugging
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} <- ${proxyRes.statusCode}`);
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

// Apply proxy to all routes
app.use('*', proxy);

// Start server
app.listen(PORT, () => {
  console.log(`Backend proxy server running on http://localhost:${PORT}`);
  console.log(`Proxying requests to ${TARGET_SERVICE}`);
});
