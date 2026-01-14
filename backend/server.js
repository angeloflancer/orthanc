require('dotenv').config();
const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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
  selfHandleResponse: true, // Handle response manually to intercept HTML
  onProxyReq: (proxyReq, req, res) => {
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${TARGET_SERVICE}${req.originalUrl}`);
  },
  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} <- ${proxyRes.statusCode}`);
    
    // Check if response is HTML
    const contentType = proxyRes.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      console.log(`\n========== HTML Response Detected ==========`);
      console.log(`Method: ${req.method}`);
      console.log(`URL: ${req.originalUrl}`);
      console.log(`Status Code: ${proxyRes.statusCode}`);
      
      // Convert buffer to string
      let modifiedHtml = responseBuffer.toString('utf8');
      
      // Replace logo and product info
      const assetsDir = path.join(__dirname, 'assets');
      const logoPath = path.join(assetsDir, 'emedx-logo.png');
      let logoDataUrl = null;
      
      // Read logo file once if it exists
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        logoDataUrl = `data:image/png;base64,${logoBase64}`;
        console.log('Logo file loaded');
      } else {
        console.warn(`Logo file not found at ${logoPath}`);
      }
      
      // Replace Orthanc logo images with custom logo
      if (logoDataUrl) {
        modifiedHtml = modifiedHtml.replace(/src="img\/orthanc\.png"/g, `src="${logoDataUrl}"`);
        modifiedHtml = modifiedHtml.replace(/src='img\/orthanc\.png'/g, `src='${logoDataUrl}'`);
        console.log('Logo images replaced');
      }
      
      // Replace product info text (Orthanc version info, product names, etc.)
      modifiedHtml = modifiedHtml.replace(/Orthanc:?\s*{{[^}]*orthancSystem\.Version[^}]*}}/g, 'EMEDX');
      modifiedHtml = modifiedHtml.replace(/Orthanc:?\s*\d+\.\d+\.\d+/g, 'EMEDX');
      modifiedHtml = modifiedHtml.replace(/Orthanc\s*Web\s*Viewer/gi, 'EMEDX');
      modifiedHtml = modifiedHtml.replace(/orthanc-system/gi, 'emedx-system');
      console.log('Product info text replaced');
      
      // Replace product info images (any Orthanc branding images)
      if (logoDataUrl) {
        modifiedHtml = modifiedHtml.replace(/src="[^"]*orthanc[^"]*\.(png|jpg|jpeg|svg)"/gi, `src="${logoDataUrl}"`);
        modifiedHtml = modifiedHtml.replace(/src='[^']*orthanc[^']*\.(png|jpg|jpeg|svg)'/gi, `src='${logoDataUrl}'`);
        console.log('Product info images replaced');
      }
      
      console.log(`HTML modified and sent to browser`);
      console.log(`=====================================================\n`);
      
      // Return modified HTML
      return modifiedHtml;
    }
    
    // For non-HTML responses, return original buffer
    return responseBuffer;
  }),
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
