# Orthanc Backend Proxy Server

This is an Express.js proxy server that forwards all API requests from the frontend to the Orthanc service running on `localhost:8042`.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on port `5830`.

## How it works

- The backend accepts all HTTP requests (GET, POST, PUT, DELETE, etc.)
- It forwards the request to `http://localhost:8042` with the same method, URL, headers, and body
- The response from the service is returned to the frontend

## Configuration

- **Port**: 5830 (configured in `server.js`)
- **Target Service**: `http://localhost:8042` (configured in `server.js`)

To change these values, edit the constants at the top of `server.js`.
