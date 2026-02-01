const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '';
const API_BASE = IS_DEV ? 'http://localhost:8000' : 'https://restruct-4oeq.onrender.com';

// Individual service URLs (maintaining backward compatibility with existing variable names)
const API_URL = API_BASE;
const API_BASE_URL = `${API_BASE}/v1`;
const STATS_API_BASE = `${API_BASE}/v1`;
