// Base URL for the application - should be '/' for root deployment
// For subpath deployment (e.g., /orthanc/), set this to the subpath
export var baseOe2Url = '/';

// Backend URL: same host as frontend, port 5830 (fallback to localhost when not in browser)
function getBackendBaseUrl() {
    if (typeof window !== 'undefined' && window.location) {
        return window.location.protocol + '//' + window.location.hostname + ':5830';
    }
    return 'http://localhost:5830';
}

const backendBase = getBackendBaseUrl();
export var orthancApiUrl = backendBase + '/';
export var oe2ApiUrl = backendBase + '/ui/api/';