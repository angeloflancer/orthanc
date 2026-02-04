// Load .env from a known location so the backend always uses it (dotenv default is process.cwd(), which fails when run from another dir).
const path = require('path');
const fs = require('fs');

function loadEnv() {
  const dotenv = require('dotenv');
  // 1) When packaged (pkg): load .env from inside the exe (snapshot). No separate .env file required.
  if (typeof process.pkg !== 'undefined' && process.pkg) {
    const snapshotEnv = path.join(__dirname, '.env');
    if (fs.existsSync(snapshotEnv)) {
      dotenv.config({ path: snapshotEnv });
    }
    return;
  }
  // 2) When running with Node: load from the directory that contains server.js (backend/.env).
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config(); // fallback to default (cwd)
  }
}
loadEnv();

// Force IPv4 for localhost so nothing connects to ::1 (avoids ECONNREFUSED ::1:27017 etc.)
function normalizeLocalhostToIPv4(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/\/\/localhost:/gi, '//127.0.0.1:')
    .replace(/@localhost:/gi, '@127.0.0.1:')
    .replace(/\/\/localhost\//gi, '//127.0.0.1/')
    .replace(/@localhost\//gi, '@127.0.0.1/');
}
if (process.env.MONGODB_URI) {
  process.env.MONGODB_URI = normalizeLocalhostToIPv4(process.env.MONGODB_URI);
}

const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const orthancClient = require('./utils/orthancClient');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const wordFileRoutes = require('./routes/wordFiles');
const patientRoutes = require('./routes/patients');
const dicomStudyRoutes = require('./routes/dicomStudies');
const hospitalRoutes = require('./routes/hospital');
const memberRoutes = require('./routes/members');
const userRoutes = require('./routes/users');
const subscriptionRoutes = require('./routes/subscriptions');
const User = require('./models/User');
const DicomStudy = require('./models/DicomStudy');
const Hospital = require('./models/Hospital');
const HospitalMember = require('./models/HospitalMember');

const app = express();
const PORT = process.env.PORT || 5830;
const TARGET_SERVICE = orthancClient.getTargetBase();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Hardware fingerprint and subscription service for license protection
const { getFingerprint } = require('./utils/hardwareFingerprint');
const subscriptionService = require('./utils/subscriptionService');

// Connect to MongoDB and initialize license protection
connectDB().then(async () => {
  try {
    // Initialize hardware fingerprint on startup (caches it for later use)
    console.log('[Startup] Initializing hardware fingerprint...');
    const fingerprint = await getFingerprint();
    console.log('[Startup] Hardware fingerprint initialized');
    
    // Migrate old unencrypted subscriptions to encrypted format (as expired)
    await subscriptionService.migrateOldSubscriptions();
  } catch (error) {
    console.error('[Startup] License protection initialization error:', error.message);
    // Don't crash the server, but log the error
  }
});

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

// Word file routes (our own API - don't proxy)
app.use('/api/wordfiles', express.json());
app.use('/api/wordfiles', express.urlencoded({ extended: true }));
app.use('/api/wordfiles', wordFileRoutes);

// Patient routes (our own API - don't proxy)
app.use('/api/patients', express.json());
app.use('/api/patients', express.urlencoded({ extended: true }));
app.use('/api/patients', patientRoutes);

// DICOM study routes (our own API - don't proxy)
app.use('/api/dicom-studies', express.json());
app.use('/api/dicom-studies', express.urlencoded({ extended: true }));
app.use('/api/dicom-studies', dicomStudyRoutes);

// Hospital routes (our own API - don't proxy)
app.use('/api/hospital', express.json());
app.use('/api/hospital', express.urlencoded({ extended: true }));
app.use('/api/hospital', hospitalRoutes);

// Member routes (our own API - don't proxy)
app.use('/api/members', express.json());
app.use('/api/members', express.urlencoded({ extended: true }));
app.use('/api/members', memberRoutes);

// User routes (our own API - don't proxy)
app.use('/api/users', express.json());
app.use('/api/users', express.urlencoded({ extended: true }));
app.use('/api/users', userRoutes);

// Subscription routes (our own API - don't proxy)
app.use('/api/subscriptions', express.json());
app.use('/api/subscriptions', express.urlencoded({ extended: true }));
app.use('/api/subscriptions', subscriptionRoutes);

// Helper function to get user from token (supports owner token and DB user)
async function getUserFromToken(req) {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers.token) {
      token = req.headers.token;
    }
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET);

    // Owner token: not in DB, return synthetic user
    if (decoded.type === 'owner' && decoded.email) {
      return {
        _id: null,
        role: 'owner',
        email: decoded.email,
        name: process.env.OWNER_NAME || 'Owner',
        emailVerified: true,
        blocked: false,
        blockedBy: null
      };
    }

    const user = await User.findById(decoded.id).select('-password');
    return user;
  } catch (error) {
    return null;
  }
}

// Helper function to get allowed Orthanc study IDs based on user role
// Owner, admin, and doctor all see all DICOM data (no filtering)
async function getAllowedOrthancStudyIds(user) {
  if (!user) return [];
  // All authenticated roles see all studies - return null to indicate no filtering
  if (user.role === 'owner' || user.role === 'admin' || user.role === 'doctor') {
    return null;
  }
  return [];
}

// Custom handler for /tools/find to filter DICOM data based on role
app.post('/tools/find', express.json(), async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    
    // Check if user is blocked
    if (user.blocked && user.blockedBy === 'owner') {
      return res.status(403).json({ 
        error: 'Your account has been suspended.',
        blocked: true
      });
    }
    
    // Forward the request to Orthanc (IPv4 localhost via orthancClient)
    const orthancResponse = await orthancClient.post('/tools/find', req.body);
    let results = orthancResponse.data;
    
    // Get query level
    const queryLevel = req.body.Level;
    
    // Get allowed study IDs based on user role
    const allowedStudyIds = await getAllowedOrthancStudyIds(user);
    
    // Helper function to get hospital name for a user
    const getHospitalNameForUser = async (userId) => {
      try {
        const user = await User.findById(userId);
        if (!user) return '';
        
        if (user.role === 'admin') {
          const hospital = await Hospital.findOne({ admin: user._id });
          return hospital ? hospital.name : '';
        } else if (user.role === 'doctor') {
          const member = await HospitalMember.findOne({ user: user._id, status: 'accepted' })
            .populate('hospital');
          return member && member.hospital ? member.hospital.name : '';
        }
        return '';
      } catch (err) {
        console.error(`Error getting hospital name for user ${userId}:`, err.message);
        return '';
      }
    };
    
    // Helper function to enrich study with hospital and uploaded by info
    const enrichStudy = async (study) => {
      try {
        const dicomStudyRecord = await DicomStudy.findOne({ orthancStudyId: study.ID })
          .populate('hospital', 'name')
          .populate('uploadedBy', 'name')
          .lean();
        
        if (dicomStudyRecord) {
          // Get hospital name from hospital field
          study._hospitalName = dicomStudyRecord.hospital ? dicomStudyRecord.hospital.name : '';
          study._uploadedBy = dicomStudyRecord.uploadedByName || '';
        } else {
          study._hospitalName = '';
          study._uploadedBy = '';
        }
      } catch (err) {
        console.error(`Error enriching study ${study.ID}:`, err.message);
        study._hospitalName = '';
        study._uploadedBy = '';
      }
      return study;
    };
    
    // If allowedStudyIds is null, user is owner
    if (allowedStudyIds === null) {
      if (queryLevel === 'Study') {
        // Enrich all studies with hospital name and uploaded by info
        results = await Promise.all(results.map(enrichStudy));
      }
      return res.json(results);
    }
    
    if (queryLevel === 'Study') {
      // Filter studies directly
      results = results.filter(dicomStudy => allowedStudyIds.includes(dicomStudy?.ID));
      
      // Enrich studies with hospital name and uploaded by info
      results = await Promise.all(results.map(enrichStudy));
    } else if (queryLevel === 'Series' || queryLevel === 'Instance') {
      // For series/instances, we need to get the parent study and check
      const filteredResults = [];
      
      for (const resourceId of results) {
        try {
          // Get the resource details to find parent study
          const resourceResponse = await orthancClient.get(`/${queryLevel.toLowerCase()}s/${resourceId}`);
          const parentStudyId = resourceResponse.data.ParentStudy;
          
          if (allowedStudyIds.includes(parentStudyId)) {
            filteredResults.push(resourceId);
          }
        } catch (err) {
          // Skip if resource not found
          console.error(`Error checking resource ${resourceId}:`, err.message);
        }
      }
      
      results = filteredResults;
    } else if (queryLevel === 'Patient') {
      // For patients, we need to check if user has access to any study of the patient
      const filteredResults = [];
      
      for (const patientId of results) {
        try {
          // Get patient's studies
          const patientResponse = await orthancClient.get(`/patients/${patientId}`);
          const patientStudies = patientResponse.data.Studies || [];
          
          // Check if user has access to any of the patient's studies
          const hasAccess = patientStudies.some(dicomStudy => allowedStudyIds.includes(dicomStudy?.ID));
          
          if (hasAccess) {
            filteredResults.push(patientId);
          }
        } catch (err) {
          console.error(`Error checking patient ${patientId}:`, err.message);
        }
      }
      
      results = filteredResults;
    }
    
    res.json(results);
  } catch (error) {
    console.error('DICOM find filter error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    res.status(500).json({ error: 'Server error' });
  }
});

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
    
    // Check if response is HTML and if URL matches stone-webviewer pattern for optimization
    const contentType = proxyRes.headers['content-type'] || '';
    const isHtml = contentType.includes('text/html');
    const isStoneViewer = req.originalUrl.startsWith('/stone-webviewer/');
    
    // Only process HTML responses (with optimization for stone-webviewer)
    if (isHtml || isStoneViewer) {
      // Double-check content type if URL suggests HTML but content-type doesn't
      if (!isHtml && isStoneViewer) {
        // Try to detect HTML by checking first bytes
        const preview = responseBuffer.toString('utf8', 0, Math.min(100, responseBuffer.length));
        if (!preview.trim().startsWith('<')) {
          // Doesn't look like HTML, return original
          return responseBuffer;
        }
      }
      
      console.log(`\n========== HTML Response Detected ==========`);
      console.log(`Method: ${req.method}`);
      console.log(`URL: ${req.originalUrl}`);
      console.log(`Status Code: ${proxyRes.statusCode}`);
      
      // Convert buffer to string
      let modifiedHtml = responseBuffer.toString('utf8');
      
      // Replace logo and product info (pkg exe: try snapshot path first, then next to exe)
      const assetsDirCandidates = [
        path.join(__dirname, 'assets'),
        ...(typeof process.pkg !== 'undefined' && process.pkg
          ? [path.join(path.dirname(process.execPath), 'assets')]
          : [])
      ];
      const assetsDir = assetsDirCandidates.find(d => fs.existsSync(d)) || assetsDirCandidates[0];
      const logoPath = path.join(assetsDir, 'emedx-logo.png');
      const faviconLogoPath = path.join(assetsDir, 'logo.png');
      let logoDataUrl = null;
      let faviconDataUrl = null;
      
      // Read logo file once if it exists
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        logoDataUrl = `data:image/png;base64,${logoBase64}`;
        console.log('Logo file loaded');
      } else {
        console.warn(`Logo file not found at ${logoPath}`);
      }
      
      // Read favicon logo file for stone viewer
      if (fs.existsSync(faviconLogoPath)) {
        const faviconBuffer = fs.readFileSync(faviconLogoPath);
        const faviconBase64 = faviconBuffer.toString('base64');
        faviconDataUrl = `data:image/png;base64,${faviconBase64}`;
        console.log('Favicon logo file loaded');
      } else {
        console.warn(`Favicon logo file not found at ${faviconLogoPath}`);
      }
      
      // Replace favicon links (for stone viewer)
      if (faviconDataUrl && isStoneViewer) {
        modifiedHtml = modifiedHtml.replace(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/gi, `<link rel="icon" href="${faviconDataUrl}" />`);
        modifiedHtml = modifiedHtml.replace(/<link[^>]*href=["'][^"']*favicon[^"']*["'][^>]*rel=["'](?:shortcut )?icon["'][^>]*>/gi, `<link rel="icon" href="${faviconDataUrl}" />`);
        console.log('Favicon links replaced for stone viewer');
      }
      
      // Replace title tags - "EMEDX Viewer" for stone viewer, "EMEDX" for others
      const titleText = isStoneViewer ? 'EMEDX Viewer' : 'EMEDX';
      modifiedHtml = modifiedHtml.replace(/<title>([^<]*)<\/title>/gi, `<title>${titleText}</title>`);
      modifiedHtml = modifiedHtml.replace(/<title\s+[^>]*>([^<]*)<\/title>/gi, `<title>${titleText}</title>`);
      console.log(`Title tags replaced with "${titleText}"`);
      
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

// Frontend: serve built files on port 5829 only (backend stays on 5830 only).
// When packaged (pkg), frontend is embedded in the exe and read from the snapshot (__dirname).
const frontendDistDir = path.join(__dirname, 'frontend-dist');
if (fs.existsSync(frontendDistDir)) {
  const frontendApp = express();
  frontendApp.use(express.static(frontendDistDir));
  frontendApp.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistDir, 'index.html'));
  });
  const frontendServer = frontendApp.listen(5829, '0.0.0.0', () => {
    console.log('Frontend serving on http://localhost:5829');
  });
  frontendServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('Port 5829 in use; start backend only. Serve frontend separately on 5829.');
    } else {
      console.error('Frontend server error:', err.message);
    }
  });
}

// Proxy all other routes to Orthanc service (conditionally - only for Orthanc API routes)
app.use((req, res, next) => {
  // Don't proxy our custom API routes
  if (req.path.startsWith('/api/auth') || 
      req.path.startsWith('/api/wordfiles') ||
      req.path.startsWith('/api/patients') ||
      req.path.startsWith('/api/dicom-studies') ||
      req.path.startsWith('/api/hospital') ||
      req.path.startsWith('/api/members') ||
      req.path.startsWith('/api/users')) {
    return next();
  }
  
  // Don't proxy /tools/find - we handle it ourselves with filtering
  if (req.path === '/tools/find' && req.method === 'POST') {
    return next();
  }
  
  // Block Orthanc UI: /ui/app and /ui/app/* – do not proxy (return 404)
  if (req.path === '/ui/app' || req.path.startsWith('/ui/app/')) {
    return res.status(404).send('Not Found');
  }
  
  // Proxy all other routes to Orthanc service (e.g. /ui/api/ for frontend)
  proxy(req, res, next);
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Proxying Orthanc requests to ${TARGET_SERVICE}`);
});
