const API_URL = 'http://localhost:8000';
window.API_URL = API_URL;

// =============================================================================
// AUTHENTICATION HANDLING
// =============================================================================

function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function getUserId() {
    return localStorage.getItem('user_id') || null;
}

function getUserEmail() {
    return localStorage.getItem('user_email') || null;
}

function isAuthenticated() {
    return !!localStorage.getItem('access_token');
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    showSigninSection();
}

// ============================================
// THEME MANAGEMENT
// ============================================

const THEME_STORAGE_KEY = 'restruct-theme';
const WAVE_COVER_DELAY_MS = 650;
const WAVE_EXIT_DELAY_MS = 1350;
const WAVE_EXIT_CLEANUP_MS = 1200;
let waveTransitionTimeouts = [];
let isThemeToggling = false;

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme = savedTheme || 'light';

    setTheme(initialTheme);
}

function playWaveTransition(onCover, onExitComplete) {
    const wave = document.getElementById('waveTransition');

    if (!wave) {
        if (typeof onCover === 'function') onCover();
        if (typeof onExitComplete === 'function') onExitComplete();
        return;
    }

    // If the wave is already animating, reuse it and run the callbacks without restarting classes
    if (wave.classList.contains('active') || wave.classList.contains('exit')) {
        if (typeof onCover === 'function') onCover();
        return;
    }

    waveTransitionTimeouts.forEach(clearTimeout);
    waveTransitionTimeouts = [];

    wave.classList.remove('exit');
    wave.classList.add('active');

    const coverTimeout = setTimeout(() => {
        if (typeof onCover === 'function') onCover();
    }, WAVE_COVER_DELAY_MS);

    const exitTimeout = setTimeout(() => {
        wave.classList.remove('active');
        wave.classList.add('exit');

        const cleanupTimeout = setTimeout(() => {
            wave.classList.remove('exit');
            if (typeof onExitComplete === 'function') onExitComplete();
        }, WAVE_EXIT_CLEANUP_MS);

        waveTransitionTimeouts.push(cleanupTimeout);
    }, WAVE_EXIT_DELAY_MS);

    waveTransitionTimeouts.push(coverTimeout, exitTimeout);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    updateThemeToggleUI();

    // Refresh marketplace models to update colors
    const modelSortSelect = document.getElementById('modelSortSelect');
    if (modelSortSelect && typeof populateMarketplace === 'function') {
        populateMarketplace(modelSortSelect.value);
    }
}

function toggleTheme() {
    // Prevent rapid toggling with cooldown
    if (isThemeToggling) return;

    isThemeToggling = true;

    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    playWaveTransition(() => setTheme(newTheme), () => {
        // Reset cooldown after wave completes
        isThemeToggling = false;
    });
}

function updateThemeToggleUI() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const sunIcon = document.querySelector('#themeToggleBtn .sun-icon');
    const moonIcon = document.querySelector('#themeToggleBtn .moon-icon');

    if (sunIcon && moonIcon) {
        if (currentTheme === 'dark') {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }
}

// Initialize theme on page load
initTheme();

function showSigninSection() {
    const signinSection = document.getElementById('signinSection');
    const appShell = document.getElementById('appShell');
    if (signinSection) signinSection.classList.add('active');
    if (appShell) appShell.style.display = 'none';

    // Reset sign-in form state
    const form = document.getElementById('signinForm');
    const submitBtn = form?.querySelector('button[type="submit"]');
    const errorBanner = document.getElementById('signinErrorBanner');
    if (form) form.reset();
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
    if (errorBanner) errorBanner.classList.remove('show');

    initMeshAnimation();
}

function showAppSection() {
    const signinSection = document.getElementById('signinSection');
    const appShell = document.getElementById('appShell');
    if (signinSection) signinSection.classList.remove('active');
    if (appShell) appShell.style.display = '';
}

async function refreshSession() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) {
        logout();
        return false;
    }

    const data = await response.json();
    localStorage.setItem('access_token', data.session.access_token);
    localStorage.setItem('refresh_token', data.session.refresh_token);
    return true;
}

// Check auth on page load - try refresh if token exists
(async () => {
    if (!isAuthenticated()) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
            const refreshed = await refreshSession();
            if (!refreshed) {
                showSigninSection();
                return;
            }
        } else {
            showSigninSection();
            return;
        }
    }

    // User is authenticated, show app
    showAppSection();
    loadProfilesFromBackend();

    // Refresh token every 50 minutes (tokens expire after 1 hour)
    setInterval(refreshSession, 50 * 60 * 1000);
})()

// Wire up logout button and display user email
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    const navSignOutBtn = document.getElementById('navSignOutBtn');
    const navSignInBtn = document.getElementById('navSignInBtn');
    const userEmailDisplay = document.getElementById('userEmailDisplay');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    if (navSignOutBtn) {
        navSignOutBtn.addEventListener('click', logout);
    }

    // Show/hide auth buttons based on login state
    const authenticated = isAuthenticated();
    if (navSignInBtn) navSignInBtn.style.display = authenticated ? 'none' : 'block';
    if (navSignOutBtn) navSignOutBtn.style.display = authenticated ? 'block' : 'none';

    if (userEmailDisplay) {
        const email = getUserEmail();
        userEmailDisplay.textContent = email ? `Signed in as ${email}` : 'Not signed in';
    }

    // Update user indicator in main content
    const userEmailIndicator = document.getElementById('userEmail');
    if (userEmailIndicator) {
        const email = getUserEmail();
        userEmailIndicator.textContent = email || 'Not signed in';
    }

    // Set up sign-in form handler
    setupSigninForm();
});

// Mesh animation for sign-in page
function initMeshAnimation() {
    const canvas = document.getElementById('meshCanvas');
    const container = document.getElementById('meshBackground');
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const config = {
        gridSize: 35,
        gravityStrength: 18,
        influenceRadius: 100,
        dampening: 0.95,
        returnSpeed: 0.05,
        lineColor: 'rgba(92, 49, 30, 0.15)',
        maxDisplacement: 20
    };

    let points = [];
    let originalPoints = [];
    let gridDimensions = { cols: 0, rows: 0 };
    let mouse = { x: -1000, y: -1000, isActive: false };
    let animationId = null;

    function resizeCanvas() {
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        canvas.width = rect.width;
        canvas.height = rect.height;
        initializeGrid();
    }

    function initializeGrid() {
        points = [];
        originalPoints = [];
        const cols = Math.ceil(canvas.width / config.gridSize) + 1;
        const rows = Math.ceil(canvas.height / config.gridSize) + 1;
        gridDimensions = { cols, rows };

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const x = i * config.gridSize;
                const y = j * config.gridSize;
                points.push({ x, y, vx: 0, vy: 0, originalX: x, originalY: y });
                originalPoints.push({ x, y });
            }
        }
    }

    function updatePoints() {
        points.forEach((point, index) => {
            const original = originalPoints[index];
            const dx = mouse.x - point.x;
            const dy = mouse.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (mouse.isActive && distance < config.influenceRadius) {
                const force = (1 - distance / config.influenceRadius) * config.gravityStrength;
                const angle = Math.atan2(dy, dx);
                point.vx += Math.cos(angle) * force * 0.01;
                point.vy += Math.sin(angle) * force * 0.01;
            } else {
                point.vx += (original.x - point.x) * config.returnSpeed;
                point.vy += (original.y - point.y) * config.returnSpeed;
            }

            point.vx *= config.dampening;
            point.vy *= config.dampening;
            point.x += point.vx;
            point.y += point.vy;

            const dispX = point.x - original.x;
            const dispY = point.y - original.y;
            const displacement = Math.sqrt(dispX * dispX + dispY * dispY);

            if (displacement > config.maxDisplacement) {
                const scale = config.maxDisplacement / displacement;
                point.x = original.x + dispX * scale;
                point.y = original.y + dispY * scale;
            }
        });
    }

    function drawMesh() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const { cols, rows } = gridDimensions;
        if (!cols || !rows || points.length === 0) return;

        ctx.strokeStyle = config.lineColor;
        ctx.lineWidth = 1;

        for (let j = 0; j < rows; j++) {
            ctx.beginPath();
            for (let i = 0; i < cols; i++) {
                const index = i * rows + j;
                const point = points[index];
                if (!point) continue;
                if (i === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
        }

        for (let i = 0; i < cols; i++) {
            ctx.beginPath();
            for (let j = 0; j < rows; j++) {
                const index = i * rows + j;
                const point = points[index];
                if (!point) continue;
                if (j === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
        }
    }

    function animate() {
        updatePoints();
        drawMesh();
        animationId = requestAnimationFrame(animate);
    }

    const parentElement = container.parentElement;

    window.addEventListener('resize', resizeCanvas);
    if (parentElement) {
        parentElement.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top, isActive: true };
        });
        parentElement.addEventListener('mouseleave', () => {
            mouse.isActive = false;
        });
    }

    setTimeout(() => {
        resizeCanvas();
        requestAnimationFrame(animate);
    }, 50);
}

// Sign-in form handler
function setupSigninForm() {
    const form = document.getElementById('signinForm');
    const errorBanner = document.getElementById('signinErrorBanner');
    if (!form) return;

    function showError(msg) {
        if (errorBanner) {
            errorBanner.textContent = msg;
            errorBanner.classList.add('show');
        }
    }

    function hideError() {
        if (errorBanner) {
            errorBanner.classList.remove('show');
        }
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideError();

        const email = document.getElementById('signinEmail').value;
        const password = document.getElementById('signinPassword').value;
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        fetch(`${API_URL}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json().then(data => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
            if (ok && data.success) {
                localStorage.setItem('access_token', data.session.access_token);
                localStorage.setItem('refresh_token', data.session.refresh_token);
                localStorage.setItem('user_id', data.user.id);
                localStorage.setItem('user_email', data.user.email);

                const applySignedInState = () => {
                    showAppSection();
                    loadConversationsFromBackend();  // Load user's conversations after login
                    loadProfilesFromBackend();
                    // Update user displays
                    const userEmailDisplay = document.getElementById('userEmailDisplay');
                    const userEmailIndicator = document.getElementById('userEmail');
                    const navSignInBtn = document.getElementById('navSignInBtn');
                    const navSignOutBtn = document.getElementById('navSignOutBtn');

                    if (userEmailDisplay) userEmailDisplay.textContent = `Signed in as ${data.user.email}`;
                    if (userEmailIndicator) userEmailIndicator.textContent = data.user.email;
                    if (navSignInBtn) navSignInBtn.style.display = 'none';
                    if (navSignOutBtn) navSignOutBtn.style.display = 'block';
                };

                playWaveTransition(applySignedInState);
            } else {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                const msg = data.detail || '';
                if (msg.toLowerCase().includes('email not confirmed')) {
                    showError('Please confirm your email before signing in. Check your inbox for a confirmation link.');
                } else {
                    showError(msg || 'Sign in failed. Please check your credentials.');
                }
            }
        })
        .catch(err => {
            console.error('Sign in error:', err);
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            showError('Could not connect to server. Is the backend running?');
        });
    });
}

// =============================================================================
// END AUTHENTICATION HANDLING
// =============================================================================

// Conversation stats tracking
const sessionStats = {
    inputTokens: 0,
    outputTokens: 0,
    modelsUsed: new Set(),
    routingTimes: [],
    responseTimes: [],
    totalCost: 0
};

function updateSessionStats() {
    document.getElementById('statsInputTokens').textContent = sessionStats.inputTokens.toLocaleString();
    document.getElementById('statsOutputTokens').textContent = sessionStats.outputTokens.toLocaleString();

    // Display model names as chips
    const modelsUsedEl = document.getElementById('statsModelsUsed');
    if (sessionStats.modelsUsed.size === 0) {
        modelsUsedEl.innerHTML = '<div class="model-chip">None</div>';
    } else {
        const chips = Array.from(sessionStats.modelsUsed)
            .map(model => `<div class="model-chip">${model}</div>`)
            .join('');
        modelsUsedEl.innerHTML = chips;
    }

    const avgRouting = sessionStats.routingTimes.length > 0
        ? Math.round(sessionStats.routingTimes.reduce((a, b) => a + b, 0) / sessionStats.routingTimes.length)
        : 0;
    const avgResponse = sessionStats.responseTimes.length > 0
        ? Math.round(sessionStats.responseTimes.reduce((a, b) => a + b, 0) / sessionStats.responseTimes.length)
        : 0;
    document.getElementById('statsAvgRouting').textContent = `${avgRouting}ms`;
    document.getElementById('statsAvgResponse').textContent = `${avgResponse}ms`;
    document.getElementById('statsTotalCost').textContent = formatConversationCost(sessionStats.totalCost);
}

function resetSessionStats() {
    sessionStats.inputTokens = 0;
    sessionStats.outputTokens = 0;
    sessionStats.modelsUsed = new Set();
    sessionStats.routingTimes = [];
    sessionStats.responseTimes = [];
    sessionStats.totalCost = 0;
    updateSessionStats();
}

function renderAttachmentPreview() {
    if (!attachmentPreview) return;

    attachmentPreview.innerHTML = '';
    if (attachedFiles.length === 0) {
        attachmentPreview.classList.remove('has-files');
        return;
    }

    attachmentPreview.classList.add('has-files');
    attachedFiles.forEach((file, index) => {
        const chip = document.createElement('div');
        chip.className = 'attachment-chip';

        const icon = document.createElement('svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', '#8e3c2c');
        icon.setAttribute('stroke-width', '2');
        icon.setAttribute('stroke-linecap', 'round');
        icon.setAttribute('stroke-linejoin', 'round');
        icon.innerHTML = '<path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07L14.36 4.5a3.5 3.5 0 0 1 4.95 4.95L10 18.76a2 2 0 1 1-2.83-2.83L16.17 6.93"></path>';
        chip.appendChild(icon);

        const name = document.createElement('span');
        name.textContent = file.name;
        chip.appendChild(name);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-attachment';
        removeBtn.setAttribute('data-remove-index', index);
        removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
        removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M6 18L18 6"></path></svg>';
        chip.appendChild(removeBtn);

        attachmentPreview.appendChild(chip);
    });
}

function resetAttachments() {
    attachedFiles = [];
    renderAttachmentPreview();
    if (chatFileInput) {
        chatFileInput.value = '';
    }
}

// Tab navigation
const tabButtons = document.querySelectorAll('.nav-icon-button');
const tabPanels = document.querySelectorAll('.tab-panel');
const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const promptInput = document.getElementById('promptInput');
const sendButton = document.getElementById('sendButton');
const attachmentButton = document.getElementById('attachmentButton');
const chatFileInput = document.getElementById('chatFileInput');
const attachmentPreview = document.getElementById('attachmentPreview');
const modelPicker = document.getElementById('modelPicker');
const modelSelect = document.getElementById('modelSelect');

// Profile controls
const profilesGrid = document.getElementById('profilesGrid');
const communityProfilesGrid = document.getElementById('communityProfilesGrid');
const communityProfilesSearch = document.getElementById('communityProfilesSearch');
const codeFlowProfilesGrid = document.getElementById('codeFlowProfilesGrid');
const profileStatsModal = document.getElementById('profileStatsModal');
const closeProfileStats = document.getElementById('closeProfileStats');
const statsProfileName = document.getElementById('statsProfileName');
const statsTokensRouted = document.getElementById('statsTokensRouted');
const statsTokensGenerated = document.getElementById('statsTokensGenerated');
const statsSpend = document.getElementById('statsSpend');
const statsGlobalRouted = document.getElementById('statsGlobalRouted');
const statsGlobalGenerated = document.getElementById('statsGlobalGenerated');
const statsMessagesRouted = document.getElementById('statsMessagesRouted');
const newProfileBtn = document.getElementById('newProfileBtn');
const createNewProfileCard = document.getElementById('createNewProfileCard');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const deleteProfileBtn = document.getElementById('deleteProfileBtn');
const latencyPriority = document.getElementById('latencyPriority');
const costPriority = document.getElementById('costPriority');
const qualityPriority = document.getElementById('qualityPriority');
const latencyValue = document.getElementById('latencyValue');
const costValue = document.getElementById('costValue');
const qualityValue = document.getElementById('qualityValue');

// Modal controls
const profileModal = document.getElementById('profileModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalProfileName = document.getElementById('modalProfileName');
const deleteProfileModal = document.getElementById('deleteProfileModal');
const deleteProfileMessage = document.getElementById('deleteProfileMessage');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

let currentProfileName = 'default';
let attachedFiles = [];
let profileToDelete = null;

const spendIds = {
    daily: document.getElementById('spendDaily'),
    weekly: document.getElementById('spendWeekly'),
    monthly: document.getElementById('spendMonthly'),
    yearly: document.getElementById('spendYearly'),
    last24: document.getElementById('spendLast24')
};

const tokenIds = {
    daily: document.getElementById('tokensDaily'),
    weekly: document.getElementById('tokensWeekly'),
    monthly: document.getElementById('tokensMonthly'),
    yearly: document.getElementById('tokensYearly')
};

const dashboardData = {
    spending: {
        daily: 482.31,
        weekly: 2984.12,
        monthly: 12350.44,
        yearly: 148233.9,
        last24: 520.67
    },
    tokens: {
        daily: 982000,
        weekly: 6592000,
        monthly: 26588000,
        yearly: 312450000
    },

};

let isLoading = false;

function formatCurrency(value) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatNumber(value) {
    return value.toLocaleString();
}

function formatConversationCost(value) {
    if (!Number.isFinite(value)) return '$0.0000';
    const precision = value >= 0.01 ? 4 : 6;
    return `$${value.toFixed(precision)}`;
}

function hydrateDashboard() {
    if (spendIds.daily) {
        spendIds.daily.textContent = formatCurrency(dashboardData.spending.daily);
        spendIds.weekly.textContent = formatCurrency(dashboardData.spending.weekly);
        spendIds.monthly.textContent = formatCurrency(dashboardData.spending.monthly);
        spendIds.yearly.textContent = formatCurrency(dashboardData.spending.yearly);
        spendIds.last24.textContent = formatCurrency(dashboardData.spending.last24);
    }

    if (tokenIds.daily) {
        tokenIds.daily.textContent = formatNumber(dashboardData.tokens.daily);
        tokenIds.weekly.textContent = formatNumber(dashboardData.tokens.weekly);
        tokenIds.monthly.textContent = formatNumber(dashboardData.tokens.monthly);
        tokenIds.yearly.textContent = formatNumber(dashboardData.tokens.yearly);
    }


}

function wireTabs() {
    // Set the Chat button (first nav button) as active initially
    if (tabButtons.length > 0) {
        tabButtons[0].classList.add('active');
    }

    // Handle icon button clicks
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.tabTarget;
            if (!target) return;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabPanels.forEach(panel => {
                panel.classList.toggle('active', panel.id === target);
            });
        });
    });
}


// Profile management
const profiles = {
    'default': { name: 'Default', latency: 'medium', cost: 'medium', quality: 'medium', description: 'Balanced' },
    'cost-optimized': { name: 'Cost Optimized', latency: 'low', cost: 'high', quality: 'low', description: 'Minimize costs' },
    'performance-first': { name: 'Performance First', latency: 'high', cost: 'low', quality: 'high', description: 'Best quality responses' }
};
const baseProfileOrder = ['default', 'cost-optimized', 'performance-first'];
const profileStats = {
    'default': { tokensRouted: 125000, tokensGenerated: 98000, spend: 235.12, globalRouted: 480000, globalGenerated: 380000, published: false, messageCount: 0 },
    'cost-optimized': { tokensRouted: 89000, tokensGenerated: 76000, spend: 142.55, globalRouted: null, globalGenerated: null, published: false, messageCount: 0 },
    'performance-first': { tokensRouted: 142000, tokensGenerated: 130000, spend: 412.44, globalRouted: 620000, globalGenerated: 500000, published: true, messageCount: 0 }
};
const codeFlowProfiles = {
    'default-code-flow': {
        name: 'Default Coding Flow',
        flow: {
            planning: 'Claude Opus 4.5',
            execution: 'GPT 5.1 Codex Max Low',
            verification: 'Gemini 3 Pro'
        }
    }
};
profileStats['default-code-flow'] = profileStats['default-code-flow'] || { tokensRouted: 0, tokensGenerated: 0, spend: 0, globalRouted: null, globalGenerated: null, published: false, messageCount: 0 };

function updatePriorityDisplays() {
    if (latencyValue) latencyValue.textContent = capitalizeFirst(latencyPriority.value);
    if (costValue) costValue.textContent = capitalizeFirst(costPriority.value);
    if (qualityValue) qualityValue.textContent = capitalizeFirst(qualityPriority.value);
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function loadProfileToModal(profileName) {
    const profile = profiles[profileName];
    if (!profile) return;

    currentProfileName = profileName;
    latencyPriority.value = profile.latency;
    costPriority.value = profile.cost;
    qualityPriority.value = profile.quality;
    updatePriorityDisplays();

    const displayName = profile.name || profileName.split('-').map(capitalizeFirst).join(' ');
    modalProfileName.value = displayName;

    const isDefaultProfile = ['default', 'cost-optimized', 'performance-first'].includes(profileName);
    if (deleteProfileBtn) {
        deleteProfileBtn.style.display = isDefaultProfile ? 'none' : 'block';
    }
}

function openProfileModal(profileName) {
    loadProfileToModal(profileName);
    profileModal.classList.add('active');
}

function closeProfileModal() {
    profileModal.classList.remove('active');
}

function showDeleteConfirmation(profileName, profileLabel) {
    profileToDelete = { name: profileName, label: profileLabel };
    if (deleteProfileMessage) {
        deleteProfileMessage.textContent = `Are you sure you want to delete "${profileLabel}"?`;
    }
    if (deleteProfileModal) {
        deleteProfileModal.classList.add('active');
    }
}

function closeDeleteModal() {
    if (deleteProfileModal) {
        deleteProfileModal.classList.remove('active');
    }
    profileToDelete = null;
}

function updateProfileBadges(card, profile) {
    const badges = card.querySelector('.profile-badges');
    if (!badges) return;
    badges.innerHTML = '';
}

function getProfileDisplayName(profileName) {
    const profile = profiles[profileName];
    if (profile?.name) return profile.name;
    return profileName.split('-').map(capitalizeFirst).join(' ');
}

function setActiveProfile(profileName) {
    document.querySelectorAll('.profile-card').forEach(card => {
        const isActive = card.dataset.profile === profileName;
        card.classList.toggle('active', isActive);

        if (isActive) {
            card.style.border = '2px solid #8e3c2c';
        } else {
            card.style.border = '2px solid rgba(92, 49, 30, 0.12)';
        }
    });
    currentProfileName = profileName;

    const profileIndicator = document.getElementById('currentProfileName');
    if (profileIndicator) {
        const activeCard = document.querySelector(`.profile-card[data-profile="${profileName}"]`);
        const displayName = activeCard ? activeCard.dataset.profileLabel : getProfileDisplayName(profileName);
        profileIndicator.textContent = displayName;
    }
}

function openProfileInBuilder(profileName) {
    const profileData = profiles[profileName] || {};
    if (baseProfileOrder.includes(profileName)) return;
    setActiveProfile(profileName);
    if (window.profileBuilderOverlay?.open) {
        window.profileBuilderOverlay.open({
            profile: {
                slug: profileName,
                name: profileData.name || getProfileDisplayName(profileName),
                description: profileData.description,
                graph_state: profileData.graph_state,
                user_id: profileData.user_id,
                id: profileData.supabase_id,
                published: profileStats[profileName]?.published
            }
        });
    }
}

function buildProfileCard(slug, displayName, profileData) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.dataset.profile = slug;
    card.dataset.profileLabel = displayName;
    card.style.cssText = 'background: var(--bg-elevated); border-radius: 18px; border: 2px solid var(--border-subtle); padding: 18px;';

    const isDefault = ['default', 'cost-optimized', 'performance-first'].includes(slug);
    const isPublished = profileStats[slug]?.published;
    const publishButtonHtml = isDefault ? '' : `
        <button class="profile-publish-btn ${isPublished ? 'published' : ''}" data-profile="${slug}" title="${isPublished ? 'Published' : 'Publish'}" aria-label="Publish profile">
            ${isPublished ? 'Published' : 'Publish'}
        </button>
    `;
    const routeButtonHtml = isDefault ? '' : `
        <button class="profile-route-btn" title="Edit in routing lab" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 10px; border: 1px solid var(--accent-primary); border-radius: 8px; background: var(--accent-primary); color: var(--text-on-dark); font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit
        </button>
    `;
    const statsButtonHtml = `
        <button class="profile-stats-btn" title="View statistics" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--bg-elevated); color: var(--text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
            <img src="assets/stats-icon.png" alt="Stats" style="width: 12px; height: 12px; opacity: 0.7;">
            Stats
        </button>
    `;
    const shareButtonHtml = !isDefault ? `
        <button class="profile-share-btn" data-profile="${slug}" title="Share profile" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--bg-elevated); color: var(--text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            Share
        </button>
    ` : '';
    const deleteButtonHtml = !isDefault ? `
        <button class="profile-delete-btn" title="Delete profile" aria-label="Delete profile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
        </button>
    ` : '';

    const headerActionsHtml = (publishButtonHtml || deleteButtonHtml) ? `
        <div class="profile-card-actions-row">
            ${publishButtonHtml}
            ${deleteButtonHtml}
        </div>
    ` : '';

    const footerButtons = [routeButtonHtml, statsButtonHtml, shareButtonHtml].filter(Boolean).join('');

    card.innerHTML = `
        <div class="profile-card-header">
            <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">${displayName}</h4>
            ${headerActionsHtml}
        </div>
        <div style="display: flex; gap: 8px;">
            ${footerButtons}
        </div>
    `;
    return card;
}

function renderYourProfiles(filteredSlugs = null) {
    if (!profilesGrid) return;
    const createCard = createNewProfileCard;
    if (createCard && createCard.parentElement === profilesGrid) {
        createCard.remove();
    }

    profilesGrid.innerHTML = '';
    const orderedProfiles = filteredSlugs !== null ? filteredSlugs : [
        ...baseProfileOrder.filter(slug => profiles[slug]),
        ...Object.keys(profiles).filter(slug => !baseProfileOrder.includes(slug))
    ];

    orderedProfiles.forEach(slug => {
        const card = buildProfileCard(slug, getProfileDisplayName(slug), profiles[slug]);
        profilesGrid.appendChild(card);
    });

    if (createCard) {
        profilesGrid.appendChild(createCard);
    }

    if (orderedProfiles.length && (!currentProfileName || !profiles[currentProfileName])) {
        currentProfileName = orderedProfiles[0];
    }
    if (currentProfileName) {
        setActiveProfile(currentProfileName);
    }
}

if (profilesGrid) {
    renderYourProfiles();
}

function buildCodeFlowCard(slug, profile) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.dataset.codeflowProfile = slug;
    card.style.cssText = 'background: var(--bg-elevated); border-radius: 18px; border: 2px solid var(--border-subtle); padding: 18px;';

    const deleteBtnHtml = slug === 'default-code-flow' ? '' : `
        <button class="profile-delete-btn" title="Delete profile" aria-label="Delete profile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
        </button>
    `;

    card.innerHTML = `
        <div class="profile-card-header">
            <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">${profile.name}</h4>
            <div class="profile-card-actions-row">
                ${deleteBtnHtml}
            </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
            <button class="codeflow-edit-btn profile-route-btn" data-slug="${slug}" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 10px; border: 1px solid var(--accent-primary); border-radius: 8px; background: var(--accent-primary); color: var(--text-on-dark); font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">Edit</button>
            <button class="codeflow-stats-btn profile-stats-btn" data-slug="${slug}" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--bg-elevated); color: var(--text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
                <img src="assets/stats-icon.png" alt="Stats" style="width: 12px; height: 12px; opacity: 0.7;">
                Stats
            </button>
        </div>
    `;
    return card;
}

function renderCodeFlowProfiles() {
    if (!codeFlowProfilesGrid) return;
    codeFlowProfilesGrid.innerHTML = '';
    const ordered = ['default-code-flow', ...Object.keys(codeFlowProfiles).filter(k => k !== 'default-code-flow')];

    ordered.forEach(slug => {
        const profile = codeFlowProfiles[slug];
        if (!profile) return;
        const card = buildCodeFlowCard(slug, profile);
        codeFlowProfilesGrid.appendChild(card);
    });

    const createCard = document.getElementById('createNewCodeFlowProfileCard');
    if (createCard) {
        createCard.remove();
    }
    const newCard = document.createElement('div');
    newCard.id = 'createNewCodeFlowProfileCard';
    newCard.className = 'profile-card';
    newCard.style.cssText = 'background: var(--bg-elevated); border-radius: 18px; border: 2px dashed var(--border-accent-dashed); padding: 18px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; min-height: 100px;';
    newCard.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            style="margin-bottom: 12px; opacity: 0.6;">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-secondary);">Create new code flow</p>
    `;
    codeFlowProfilesGrid.appendChild(newCard);
}

function openCodeFlowBuilder(slug) {
    const profile = codeFlowProfiles[slug];
    if (!profile) return;
    profiles[slug] = profiles[slug] || { name: profile.name };
    profileStats[slug] = profileStats[slug] || { tokensRouted: 0, tokensGenerated: 0, spend: 0, globalRouted: null, globalGenerated: null, published: false, messageCount: 0 };

    if (window.profileBuilderOverlay?.open) {
        window.profileBuilderOverlay.open({
            mode: 'codeflow',
            profile: {
                name: profile.name,
                flow: profile.flow
            },
            onSave: (updated) => {
                if (updated?.flow) {
                    codeFlowProfiles[slug].flow = updated.flow;
                }
                if (updated?.name) {
                    codeFlowProfiles[slug].name = updated.name;
                    profiles[slug].name = updated.name;
                }
                renderCodeFlowProfiles();
            }
        });
    }
}

if (codeFlowProfilesGrid) {
    renderCodeFlowProfiles();
    codeFlowProfilesGrid.addEventListener('click', (e) => {
        const createCard = e.target.closest('#createNewCodeFlowProfileCard');
        if (createCard) {
            const slug = `codeflow-${Date.now()}`;
            codeFlowProfiles[slug] = {
                name: 'New Code Flow',
                flow: { planning: '', execution: '', verification: '' }
            };
            profileStats[slug] = { tokensRouted: 0, tokensGenerated: 0, spend: 0, globalRouted: null, globalGenerated: null, published: false, messageCount: 0 };
            renderCodeFlowProfiles();
            openCodeFlowBuilder(slug);
            return;
        }

        const card = e.target.closest('.profile-card');
        if (!card) return;
        const slug = card.dataset.codeflowProfile;
        if (!slug) return;

        const deleteBtn = e.target.closest('.profile-delete-btn');
        if (deleteBtn) {
            if (slug === 'default-code-flow') return;
            delete codeFlowProfiles[slug];
            delete profileStats[slug];
            renderCodeFlowProfiles();
            return;
        }

        const editBtn = e.target.closest('.codeflow-edit-btn');
        if (editBtn) {
            openCodeFlowBuilder(slug);
            return;
        }

        const statsBtn = e.target.closest('.codeflow-stats-btn');
        if (statsBtn) {
            profiles[slug] = profiles[slug] || { name: codeFlowProfiles[slug]?.name || slug };
            openProfileStatsModal(slug);
            return;
        }
    });
}
// Profile card clicks
if (profilesGrid) {
    profilesGrid.addEventListener('click', (e) => {
        const routeBtn = e.target.closest('.profile-route-btn');
        if (routeBtn) {
            e.stopPropagation();
            const card = routeBtn.closest('.profile-card');
            if (card) {
                const profileName = card.dataset.profile;
                openProfileInBuilder(profileName);
            }
            return;
        }

        const statsBtn = e.target.closest('.profile-stats-btn');
        if (statsBtn) {
            e.stopPropagation();
            const card = statsBtn.closest('.profile-card');
            if (card) {
                const profileName = card.dataset.profile;
                openProfileStatsModal(profileName);
            }
            return;
        }

        const shareBtn = e.target.closest('.profile-share-btn');
        if (shareBtn) {
            e.stopPropagation();
            const profileSlug = shareBtn.dataset.profile;
            const shareCode = generateShareCode(profileSlug);
            if (shareCode) {
                showShareCodeModal(shareCode);
            }
            return;
        }

        const deleteBtn = e.target.closest('.profile-delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const card = deleteBtn.closest('.profile-card');
            if (card) {
                const profileName = card.dataset.profile;
                const profileLabel = card.dataset.profileLabel;
                showDeleteConfirmation(profileName, profileLabel);
            }
            return;
        }

        const card = e.target.closest('.profile-card');
        if (!card) return;

        const publishBtn = e.target.closest('.profile-publish-btn');
        if (publishBtn) {
            const profileName = publishBtn.dataset.profile;
            publishProfile(profileName, publishBtn);
            return;
        }

        const profileName = card.dataset.profile;
        setActiveProfile(profileName);
    });
}

// Modal controls
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeProfileModal);
}

if (profileModal) {
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            closeProfileModal();
        }
    });
}

if (latencyPriority) {
    latencyPriority.addEventListener('change', updatePriorityDisplays);
}

if (costPriority) {
    costPriority.addEventListener('change', updatePriorityDisplays);
}

if (qualityPriority) {
    qualityPriority.addEventListener('change', updatePriorityDisplays);
}

function slugifyProfileName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `custom-${Date.now()}`;
}

function derivePriorityLevels(graphState) {
    const levels = { latency: 'medium', cost: 'medium', quality: 'medium' };
    const priorities = graphState?.priorities || graphState?.weights;
    if (!priorities) return levels;

    const toLevel = (weight) => {
        if (weight >= 0.67) return 'high';
        if (weight <= 0.33) return 'low';
        return 'medium';
    };

    priorities.forEach(priority => {
        if (priority.id === 'latency') levels.latency = toLevel(priority.weight);
        if (priority.id === 'cost') levels.cost = toLevel(priority.weight);
        if (priority.id === 'quality') levels.quality = toLevel(priority.weight);
    });
    return levels;
}

function ensureProfileStats(slug) {
    if (!profileStats[slug]) {
        profileStats[slug] = { tokensRouted: 0, tokensGenerated: 0, spend: 0, globalRouted: null, globalGenerated: null, published: false, messageCount: 0 };
    }
    return profileStats[slug];
}

function upsertProfileFromBackend(profile) {
    if (!profile) return null;
    const slug = profile.slug || profile.id;
    if (!slug) return null;

    const priorityLevels = derivePriorityLevels(profile.graph_state);
    const displayName = profile.name || getProfileDisplayName(slug);

    profiles[slug] = {
        ...priorityLevels,
        description: profile.description || 'Custom profile',
        graph_state: profile.graph_state,
        supabase_id: profile.id,
        user_id: profile.user_id,
        name: displayName
    };

    const stats = ensureProfileStats(slug);
    stats.published = !!profile.published;

    return slug;
}

function generateShareCode(profileSlug) {
    const profile = profiles[profileSlug];
    if (!profile) return null;

    const shareData = {
        name: profile.name,
        description: profile.description || 'Shared profile',
        latency: profile.latency,
        cost: profile.cost,
        quality: profile.quality,
        graph_state: profile.graph_state
    };

    const jsonString = JSON.stringify(shareData);
    return btoa(jsonString);
}

function importProfileFromCode(shareCode) {
    if (!shareCode || !shareCode.trim()) {
        throw new Error('Please paste a profile code');
    }

    let jsonString;
    try {
        jsonString = atob(shareCode);
    } catch (e) {
        throw new Error('Invalid profile code format');
    }

    let shareData;
    try {
        shareData = JSON.parse(jsonString);
    } catch (e) {
        throw new Error('Invalid profile code data');
    }

    if (!shareData.name || !shareData.graph_state) {
        throw new Error('Profile code is missing required data');
    }

    let baseName = shareData.name || 'Imported Profile';
    let slug = slugifyProfileName(baseName);

    if (profiles[slug]) {
        const match = baseName.match(/^(.*?)\s*(\d+)$/);
        let nameWithoutNumber;
        let counter;

        if (match) {
            nameWithoutNumber = match[1].trim();
            counter = parseInt(match[2]) + 1;
        } else {
            nameWithoutNumber = baseName;
            counter = 2;
        }

        do {
            baseName = `${nameWithoutNumber} ${counter}`;
            slug = slugifyProfileName(baseName);
            counter++;
        } while (profiles[slug]);
    }

    profiles[slug] = {
        name: baseName,
        description: shareData.description,
        latency: shareData.latency || 'medium',
        cost: shareData.cost || 'medium',
        quality: shareData.quality || 'medium',
        graph_state: shareData.graph_state
    };

    ensureProfileStats(slug);

    return slug;
}

function showToast(message, duration = 3000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = '✓';
    toast.appendChild(icon);

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.3s ease-out';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

function showShareCodeModal(shareCode) {
    const modal = document.getElementById('shareCodeModal');
    const textarea = document.getElementById('shareCodeText');
    const copyBtn = document.getElementById('shareCodeCopyBtn');
    const closeBtn = document.getElementById('shareCodeCloseBtn');

    if (!modal || !textarea || !copyBtn || !closeBtn) return;

    textarea.value = shareCode;
    modal.style.display = 'flex';

    const closeModal = () => {
        modal.style.display = 'none';
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareCode);
        showToast('Code copied to clipboard');
        closeModal();
    };

    copyBtn.onclick = handleCopy;
    closeBtn.onclick = closeModal;

    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

function generateMockCommunityProfiles() {
    const names = [
        'Ultra Cost Saver', 'Code Generator Pro', 'Speed Demon', 'Research Assistant', 'Creative Writer',
        'Data Cruncher', 'Enterprise Guard', 'Context King', 'Prompt Whisperer', 'Latency Slayer',
        'Polyglot Translator', 'Doc Summarizer', 'Productivity Booster', 'Secure Chat', 'Brainstorm Buddy',
        'Support Sidekick', 'Ops Automator', 'QA Reviewer', 'Email Polisher', 'API Tutor',
        'Visionary', 'Audio Sage', 'Synthetic QA', 'Notebook Ninja', 'Benchmark Beast'
    ];
    const publishers = [
        'Alex Rivera', 'Sarah Chen', 'Priya Nair', 'Liam O\'Connor', 'Maya Patel',
        'Jonas Keller', 'Mina Park', 'Diego Alvarez', 'Casey Jordan', 'Samira Rahman'
    ];

    const generated = Array.from({ length: 100 }, (_, i) => {
        const name = `${names[i % names.length]} v${Math.floor(i / names.length) + 1}`;
        const tokensRouted = Math.max(15000, 195000 - i * 1200);
        const tokensGenerated = Math.round(tokensRouted * (1.05 + (i % 7) * 0.03));
        const publisher = i % 6 === 0 ? 'Anonymous' : publishers[i % publishers.length];
        const slug = `${slugifyProfileName(name)}-${i}`;
        return {
            id: slug,
            name,
            publisher,
            tokensRouted,
            tokensGenerated
        };
    });

    return generated.sort((a, b) => b.tokensRouted - a.tokensRouted);
}

const communityProfiles = generateMockCommunityProfiles();

function renderCommunityProfiles(list = communityProfiles) {
    if (!communityProfilesGrid) return;
    communityProfilesGrid.innerHTML = '';

    list.forEach(profile => {
        const added = Boolean(profiles[profile.id]);
        const card = document.createElement('div');
        card.className = 'community-profile-card';
        card.dataset.slug = profile.id;
        card.innerHTML = `
            <div class="community-card-top">
                <div class="community-title-row">
                    <h4 class="community-profile-title">${profile.name}</h4>
                    <button class="community-add-btn ${added ? 'added' : ''}" data-slug="${profile.id}" title="${added ? 'Added' : 'Add to your profiles'}">
                        ${added ? '<span class="add-icon">✔</span>' : '<span class="add-icon">＋</span>'}
                    </button>
                </div>
                <p class="community-profile-publisher">${profile.publisher === 'Anonymous' ? 'Anonymous' : `By ${profile.publisher}`}</p>
            </div>
            <div class="community-profile-metrics">
                <div class="community-metric-chip">
                    <span class="community-metric-label">Tokens routed</span>
                    <span class="community-metric-value">${formatNumber(profile.tokensRouted)}</span>
                </div>
                <div class="community-metric-chip">
                    <span class="community-metric-label">Tokens generated</span>
                    <span class="community-metric-value">${formatNumber(profile.tokensGenerated)}</span>
                </div>
            </div>
        `;
        communityProfilesGrid.appendChild(card);
    });
}

if (newProfileBtn) {
    newProfileBtn.addEventListener('click', () => {
        window.profileBuilderOverlay?.open();
    });
}

if (createNewProfileCard) {
    createNewProfileCard.addEventListener('click', () => {
        window.profileBuilderOverlay?.open();
    });
}

if (communityProfilesGrid) {
    renderCommunityProfiles();
    communityProfilesGrid.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.community-add-btn');
        if (!addBtn) return;
        const slug = addBtn.dataset.slug;
        const communityProfile = communityProfiles.find(p => p.id === slug);
        if (!communityProfile) return;

        if (!profiles[slug]) {
            profiles[slug] = {
                name: communityProfile.name,
                latency: 'medium',
                cost: 'medium',
                quality: 'medium',
                description: `Community profile by ${communityProfile.publisher}`
            };
            profileStats[slug] = {
                tokensRouted: communityProfile.tokensRouted,
                tokensGenerated: communityProfile.tokensGenerated,
                spend: Math.max(25, Math.round(communityProfile.tokensRouted / 1000) / 2),
                globalRouted: null,
                globalGenerated: null,
                published: false,
                messageCount: 0
            };
            renderYourProfiles();
            showToast('Profile added to your profiles');
        }

        addBtn.classList.add('added');
        addBtn.innerHTML = '<span class="add-icon">✔</span>';
    });
}

if (communityProfilesSearch) {
    communityProfilesSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = communityProfiles.filter(profile => {
            return (
                profile.name.toLowerCase().includes(query) ||
                profile.publisher.toLowerCase().includes(query)
            );
        });
        renderCommunityProfiles(filtered);
    });
}

const yourProfilesSearch = document.getElementById('yourProfilesSearch');
if (yourProfilesSearch) {
    yourProfilesSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderYourProfiles();
            return;
        }

        const allSlugs = [
            ...baseProfileOrder.filter(slug => profiles[slug]),
            ...Object.keys(profiles).filter(slug => !baseProfileOrder.includes(slug))
        ];

        const filtered = allSlugs.filter(slug => {
            const profile = profiles[slug];
            const displayName = getProfileDisplayName(slug);
            return (
                displayName.toLowerCase().includes(query) ||
                (profile.description && profile.description.toLowerCase().includes(query))
            );
        });

        renderYourProfiles(filtered);
    });
}

const importProfileBtn = document.getElementById('importProfileBtn');
const importProfileInput = document.getElementById('importProfileInput');

if (importProfileBtn && importProfileInput) {
    const handleImport = () => {
        const shareCode = importProfileInput.value.trim();

        try {
            importProfileFromCode(shareCode);
            renderYourProfiles();
            importProfileInput.value = '';
            showToast('Profile imported successfully');
        } catch (error) {
            showToast(error.message);
        }
    };

    importProfileBtn.addEventListener('click', handleImport);
    importProfileInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleImport();
        }
    });
}

function setProfileStatsDisplay({ profileName, displayName, userStats, globalStats, published }) {
    if (statsProfileName) statsProfileName.textContent = displayName || getProfileDisplayName(profileName);
    if (statsTokensRouted) statsTokensRouted.textContent = formatNumber(userStats?.tokens_routed || 0);
    if (statsTokensGenerated) statsTokensGenerated.textContent = formatNumber(userStats?.tokens_generated || 0);
    if (statsSpend) statsSpend.textContent = `$${(userStats?.spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (statsMessagesRouted) statsMessagesRouted.textContent = formatNumber(userStats?.message_count || 0);
    const showGlobal = published && globalStats;
    if (statsGlobalRouted) statsGlobalRouted.textContent = showGlobal ? formatNumber(globalStats?.tokens_routed || 0) : 'N/A';
    if (statsGlobalGenerated) statsGlobalGenerated.textContent = showGlobal ? formatNumber(globalStats?.tokens_generated || 0) : 'N/A';
}

async function openProfileStatsModal(profileName) {
    const profile = profiles[profileName];
    const fallbackStats = profileStats[profileName] || { tokensRouted: 0, tokensGenerated: 0, spend: 0, globalRouted: null, globalGenerated: null, published: false, messageCount: 0 };
    const displayName = profile?.name || getProfileDisplayName(profileName);

    // Optimistically show zeros while fetching
    setProfileStatsDisplay({
        profileName,
        displayName,
        userStats: { tokens_routed: 0, tokens_generated: 0, spend: 0, message_count: 0 },
        globalStats: null,
        published: false
    });

    try {
        const response = await fetch(`${API_URL}/profiles/${encodeURIComponent(profileName)}/stats`, {
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        if (!response.ok) throw new Error('Failed to load stats');
        const data = await response.json();
        setProfileStatsDisplay({
            profileName,
            displayName,
            userStats: data.stats?.user,
            globalStats: data.stats?.global,
            published: !!data.profile?.published
        });
    } catch (err) {
        // Fall back to in-memory mock stats if API fails
        setProfileStatsDisplay({
            profileName,
            displayName,
            userStats: {
                tokens_routed: fallbackStats.tokensRouted,
                tokens_generated: fallbackStats.tokensGenerated,
                spend: fallbackStats.spend,
                message_count: fallbackStats.messageCount
            },
            globalStats: fallbackStats.published ? {
                tokens_routed: fallbackStats.globalRouted,
                tokens_generated: fallbackStats.globalGenerated
            } : null,
            published: fallbackStats.published
        });
    }

    if (profileStatsModal) profileStatsModal.classList.add('active');
}

async function publishProfile(profileName, buttonEl) {
    const profile = profiles[profileName] || {};
    const fallbackStats = profileStats[profileName] || { tokensRouted: 0, tokensGenerated: 0, spend: 0, globalRouted: null, globalGenerated: null, published: false, messageCount: 0 };
    const isDefaultProfile = baseProfileOrder.includes(profileName);

    if (isDefaultProfile) {
        if (buttonEl) {
            buttonEl.disabled = false;
            buttonEl.textContent = buttonEl.dataset.originalText || buttonEl.textContent;
        }
        alert('Default profiles cannot be published.');
        return;
    }

    // Optimistic UI state
    if (buttonEl) {
        buttonEl.disabled = true;
        const originalText = buttonEl.textContent;
        buttonEl.dataset.originalText = originalText;
        buttonEl.textContent = 'Publishing...';
    }

    const body = { published: true };
    let succeeded = false;

    try {
        const response = await fetch(`${API_URL}/profiles/${encodeURIComponent(profileName)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Publish failed (${response.status})`);
        }

        const data = await response.json();
        profileStats[profileName] = {
            ...fallbackStats,
            published: !!data.profile?.published
        };
        profiles[profileName] = {
            ...profile,
            supabase_id: data.profile?.id || profile.supabase_id,
            user_id: data.profile?.user_id || profile.user_id
        };
        succeeded = true;
    } catch (err) {
        console.error('Publish failed', err);
        alert('Could not publish profile. Please try again.');
    }

    if (buttonEl) {
        buttonEl.disabled = false;
        if (succeeded) {
            buttonEl.classList.add('published');
            buttonEl.textContent = 'Published';
        } else {
            buttonEl.textContent = buttonEl.dataset.originalText || 'Publish';
        }
    }
}

function closeProfileStatsModal() {
    if (profileStatsModal) profileStatsModal.classList.remove('active');
}

if (closeProfileStats) {
    closeProfileStats.addEventListener('click', closeProfileStatsModal);
}

if (profileStatsModal) {
    profileStatsModal.addEventListener('click', (e) => {
        if (e.target === profileStatsModal) closeProfileStatsModal();
    });
}

async function loadProfilesFromBackend() {
    if (!isAuthenticated()) return;

    try {
        const response = await fetch(`${API_URL}/profiles`, {
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
        });
        if (!response.ok) {
            throw new Error(`Failed to load profiles (${response.status})`);
        }
        const data = await response.json();
        const list = Array.isArray(data.profiles) ? data.profiles : [];
        let firstLoaded = null;

        list.forEach(profile => {
            const slug = upsertProfileFromBackend(profile);
            if (!firstLoaded && slug) {
                firstLoaded = slug;
            }
        });

        if (profilesGrid) {
            renderYourProfiles();
        }

        if (currentProfileName && profiles[currentProfileName]) {
            setActiveProfile(currentProfileName);
        } else if (firstLoaded) {
            setActiveProfile(firstLoaded);
        }
    } catch (err) {
        console.error('Failed to load profiles from backend', err);
    }
}

function applyProfileUpsert(profile, selectAfter = false) {
    const slug = upsertProfileFromBackend(profile);
    if (!slug) return;

    if (profilesGrid) {
        renderYourProfiles();
    }

    if (selectAfter) {
        setActiveProfile(slug);
    }
}

window.addEventListener('routing-profile:created', (event) => {
    applyProfileUpsert(event.detail?.profile, true);
});

window.addEventListener('routing-profile:updated', (event) => {
    applyProfileUpsert(event.detail?.profile, false);
});

if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
        const newDisplayName = modalProfileName.value.trim();
        if (!newDisplayName) return;

        const newCleanName = newDisplayName.toLowerCase().replace(/\s+/g, '-');
        const oldProfileName = currentProfileName;
        const isDefaultProfile = ['default', 'cost-optimized', 'performance-first'].includes(oldProfileName);

        const updatedProfile = {
            latency: latencyPriority.value,
            cost: costPriority.value,
            quality: qualityPriority.value,
            description: profiles[oldProfileName]?.description || 'Custom profile'
        };

        if (newCleanName !== oldProfileName) {
            delete profiles[oldProfileName];
            profiles[newCleanName] = updatedProfile;

            const card = document.querySelector(`[data-profile="${oldProfileName}"]`);
            if (card) {
                card.dataset.profile = newCleanName;
                const h4 = card.querySelector('h4');
                if (h4) h4.textContent = newDisplayName;
            }

            currentProfileName = newCleanName;
            setActiveProfile(newCleanName);
        } else {
            profiles[currentProfileName] = updatedProfile;

            const card = document.querySelector(`[data-profile="${currentProfileName}"]`);
            if (card) {
                const h4 = card.querySelector('h4');
                if (h4) h4.textContent = newDisplayName;
            }
        }

        closeProfileModal();
    });
}

if (deleteProfileBtn) {
    deleteProfileBtn.addEventListener('click', () => {
        if (currentProfileName === 'default') {
            return;
        }

        const card = document.querySelector(`[data-profile="${currentProfileName}"]`);
        const profileLabel = card ? card.dataset.profileLabel : currentProfileName;

        closeProfileModal();
        showDeleteConfirmation(currentProfileName, profileLabel);
    });
}

if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {
        if (!profileToDelete) return;

        const profileName = profileToDelete.name;
        const profile = profiles[profileName];
        const hasBackendId = profile && profile.supabase_id;

        const deleteFromFrontend = () => {
            delete profiles[profileName];
            delete profileStats[profileName];

            const card = document.querySelector(`[data-profile="${profileName}"]`);
            if (card) {
                card.remove();
            }

            if (currentProfileName === profileName) {
                setActiveProfile('default');
            }

            // Reset community card button if it came from community list
            if (communityProfilesGrid) {
                const communityButton = communityProfilesGrid.querySelector(`.community-add-btn[data-slug="${profileName}"]`);
                if (communityButton) {
                    communityButton.classList.remove('added');
                    communityButton.innerHTML = '<span class="add-icon">＋</span>';
                }
            }

            closeDeleteModal();
        };

        if (hasBackendId) {
            // Profile exists in backend - call DELETE API
            fetch(`${API_URL}/profiles/${profileName}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to delete profile (${response.status})`);
                }
                return response.json();
            })
            .then(() => {
                deleteFromFrontend();
            });
        } else {
            // Imported profile - only exists locally, delete immediately
            deleteFromFrontend();
        }
    });
}

if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
        closeDeleteModal();
    });
}

if (deleteProfileModal) {
    deleteProfileModal.addEventListener('click', (e) => {
        if (e.target === deleteProfileModal) {
            closeDeleteModal();
        }
    });
}

if (promptInput) {
    promptInput.addEventListener('input', function () {
        this.style.height = 'auto';
        const newHeight = Math.min(this.scrollHeight, 150);
        this.style.height = newHeight + 'px';
        this.style.overflowY = this.scrollHeight > 150 ? 'auto' : 'hidden';
    });

    promptInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            chatForm?.dispatchEvent(new Event('submit'));
        }
    });
}

if (attachmentButton && chatFileInput) {
    attachmentButton.addEventListener('click', () => {
        chatFileInput.click();
    });
}

if (chatFileInput) {
    chatFileInput.addEventListener('change', () => {
        const files = Array.from(chatFileInput.files || []);
        if (!files.length) return;

        const availableSlots = Math.max(0, 3 - attachedFiles.length);
        if (availableSlots <= 0) {
            alert('You can attach up to 3 files. Remove a file to add another.');
            chatFileInput.value = '';
            return;
        }

        const accepted = files.slice(0, availableSlots);
        if (files.length > accepted.length) {
            alert('Only 3 files can be attached at once.');
        }

        if (accepted.length) {
            attachedFiles = attachedFiles.concat(accepted);
            renderAttachmentPreview();
        }

        chatFileInput.value = '';
    });
}

if (attachmentPreview) {
    attachmentPreview.addEventListener('click', event => {
        const trigger = event.target.closest('.remove-attachment');
        if (!trigger) return;
        const index = Number(trigger.dataset.removeIndex);
        if (Number.isNaN(index)) return;
        attachedFiles.splice(index, 1);
        renderAttachmentPreview();
    });
}

if (chatForm) {
    chatForm.addEventListener('submit', async event => {
        event.preventDefault();
        const prompt = promptInput?.value.trim();
        if (!prompt || isLoading) return;

        const attachmentMetadata = attachedFiles.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type
        }));

        const currentProfile = profiles[currentProfileName] || profiles['default'];

        // Handle multiple model overrides
        if (selectedOverrideModels.length > 1) {
            await handleMultiModelSubmission(prompt, attachmentMetadata);
            return;
        }

        // Disable split-screen if it was active (switching back to single model)
        if (chatContainer && chatContainer.classList.contains('split-mode')) {
            chatContainer.classList.remove('split-mode');
        }

        const payload = {
            prompt,
            profile: currentProfileName,
            conversation_id: currentConversation.conversationId,  // Include conversation ID
            priorities: {
                latency: currentProfile.latency,
                cost: currentProfile.cost,
                quality: currentProfile.quality
            },
            max_tokens: 1000,
            temperature: 0.7,
            router_mode: selectedOverrideModels.length === 1 ? 'manual' : 'auto',
            model_override: selectedOverrideModels.length === 1 ? modelOverrideMap[selectedOverrideModels[0]] : null
        };

        if (attachmentMetadata.length) {
            payload.attachments = attachmentMetadata;
        }

        if (promptInput) {
            promptInput.value = '';
            promptInput.style.height = 'auto';
            promptInput.style.overflowY = 'hidden';
        }
        setLoading(true);

        const welcomeMsg = chatContainer?.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
            // Enter focus mode on first message
            document.body.classList.add('focus-mode');
            if (conversationStatsSidebar) {
                conversationStatsSidebar.classList.add('collapsed');
            }
        }

        addMessage('user', prompt, null, attachmentMetadata);
        resetAttachments();
        const loadingId = showLoading();

        const startTime = Date.now();

        try {
            // Create conversation first if this is a new chat
            if (!currentConversation.conversationId) {
                const title = truncateTitle(prompt);
                const convResponse = await fetch(`${API_URL}/conversations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({
                        user_id: getUserId(),
                        title: title
                    })
                });

                if (!convResponse.ok) {
                    throw new Error('Failed to create conversation');
                }

                const convData = await convResponse.json();
                currentConversation.conversationId = convData.conversation.id;
                currentConversation.title = title;
                payload.conversation_id = currentConversation.conversationId;
            }

            // Ensure user_id is set in payload
            payload.user_id = getUserId();

            const response = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const data = await response.json();
            const routingTime = data.timing?.routing_time || 0;
            const responseTime = data.timing?.inference_time || 0;

            sessionStats.inputTokens += data.usage?.input_tokens || prompt.split(' ').length * 1.3;
            sessionStats.outputTokens += data.usage?.output_tokens || data.output.split(' ').length * 1.3;
            sessionStats.modelsUsed.add(data.model);
            sessionStats.routingTimes = sessionStats.routingTimes || [];
            sessionStats.responseTimes = sessionStats.responseTimes || [];
            sessionStats.routingTimes.push(routingTime);
            sessionStats.responseTimes.push(responseTime);
            const costIncrement = Number(data.usage?.cost);
            sessionStats.totalCost += Number.isFinite(costIncrement) ? costIncrement : 0;
            updateSessionStats();

            removeLoading(loadingId);
            addMessage('assistant', data.output, {
                model: data.model,
                provider: data.provider,
                score: data.routing_metadata?.score,
                routingTime: routingTime,
                responseTime: responseTime,
                inputTokens: data.usage?.input_tokens,
                outputTokens: data.usage?.output_tokens
            });
        } catch (error) {
            console.error('Chat error:', error);
            removeLoading(loadingId);
            addMessage('assistant', `Error: ${error.message}. Make sure the backend is running and API keys are configured.`, {
                model: 'error',
                provider: 'system'
            });
        } finally {
            setLoading(false);
            promptInput?.focus();
        }
    });
}

function renderMarkdownAndLatex(text) {
    let html = text;
    const placeholders = [];

    // Step 1: Protect LaTeX expressions by replacing with placeholders
    let latexCounter = 0;
    html = html.replace(/\$\$[\s\S]+?\$\$/g, (match) => {
        const placeholder = `___LATEX_DISPLAY_${latexCounter}___`;
        placeholders.push({ placeholder, content: match });
        latexCounter++;
        return placeholder;
    });
    html = html.replace(/\$[^$\n]+?\$/g, (match) => {
        const placeholder = `___LATEX_INLINE_${latexCounter}___`;
        placeholders.push({ placeholder, content: match });
        latexCounter++;
        return placeholder;
    });

    // Step 2: Handle code blocks (triple backticks)
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Step 3: Handle inline code (single backticks)
    html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');

    // Step 4: Headers (must be at line start)
    html = html.replace(/^#### (.*?)$/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*?)$/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gim, '<h1>$1</h1>');

    // Step 5: Bold (** or __) - allow single asterisks/underscores inside
    html = html.replace(/\*\*((?:[^*\n]+|\*(?!\*))+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__((?:[^_\n]+|_(?!_))+?)__/g, '<strong>$1</strong>');

    // Step 6: Italic (* or _) - simple approach to avoid conflicts
    // Only match single asterisks/underscores that aren't at line start and aren't doubled
    html = html.replace(/([^\s\*])\*([^\*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    html = html.replace(/([^\s_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');

    // Step 7: Bullet lists (lines starting with * or -)
    const lines = html.split('\n');
    let inList = false;
    let processedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const bulletMatch = line.match(/^[\*\-]\s+(.+)/);
        const numberedMatch = line.match(/^\d+\.\s+(.+)/);

        if (bulletMatch) {
            if (!inList) {
                processedLines.push('<ul>');
                inList = 'ul';
            } else if (inList === 'ol') {
                processedLines.push('</ol>');
                processedLines.push('<ul>');
                inList = 'ul';
            }
            processedLines.push(`<li>${bulletMatch[1]}</li>`);
        } else if (numberedMatch) {
            if (!inList) {
                processedLines.push('<ol>');
                inList = 'ol';
            } else if (inList === 'ul') {
                processedLines.push('</ul>');
                processedLines.push('<ol>');
                inList = 'ol';
            }
            processedLines.push(`<li>${numberedMatch[1]}</li>`);
        } else {
            if (inList) {
                processedLines.push(inList === 'ul' ? '</ul>' : '</ol>');
                inList = false;
            }
            processedLines.push(line);
        }
    }
    if (inList) {
        processedLines.push(inList === 'ul' ? '</ul>' : '</ol>');
    }
    html = processedLines.join('\n');

    // Step 8: Blockquotes
    html = html.replace(/^&gt;\s(.+)$/gim, '<blockquote>$1</blockquote>');
    html = html.replace(/^>\s(.+)$/gim, '<blockquote>$1</blockquote>');

    // Step 9: Horizontal rules
    html = html.replace(/^---+$/gim, '<hr>');

    // Step 10: Clean line breaks
    // Remove newlines around block elements to prevent excessive spacing
    html = html.replace(/\n*(<\/?(?:h[1-4]|ul|ol|li|hr|pre|blockquote)>)\n*/g, '$1');

    // Convert double newlines to paragraph breaks
    html = html.replace(/\n\n+/g, '<br><br>');

    // Convert single newlines to line breaks (but not around block elements)
    html = html.replace(/([^>])\n([^<])/g, '$1<br>$2');

    // Clean up multiple consecutive breaks
    html = html.replace(/(<br>\s*){3,}/g, '<br><br>');

    // Step 11: Restore LaTeX expressions
    placeholders.forEach(({ placeholder, content }) => {
        html = html.replace(placeholder, content);
    });

    return html;
}

// Handle multi-model submission with split-screen display
async function handleMultiModelSubmission(prompt, attachmentMetadata) {
    if (promptInput) {
        promptInput.value = '';
        promptInput.style.height = 'auto';
        promptInput.style.overflowY = 'hidden';
    }
    setLoading(true);

    const welcomeMsg = chatContainer?.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
        document.body.classList.add('focus-mode');
        if (conversationStatsSidebar) {
            conversationStatsSidebar.classList.add('collapsed');
        }
    }

    // Add user message normally
    addMessage('user', prompt, null, attachmentMetadata);
    resetAttachments();

    // Create a multi-model response group container
    const multiModelGroupContainer = createMultiModelResponseGroup(selectedOverrideModels);
    chatContainer.appendChild(multiModelGroupContainer);

    // Create conversation if needed
    if (!currentConversation.conversationId) {
        const title = truncateTitle(prompt);
        const convResponse = await fetch(`${API_URL}/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
                user_id: getUserId(),
                title: title
            })
        });

        if (!convResponse.ok) {
            throw new Error('Failed to create conversation');
        }

        const convData = await convResponse.json();
        currentConversation.conversationId = convData.conversation.id;
        currentConversation.title = title;
    }

    // Use SSE streaming from /chat/batch endpoint for multiple models
    const payload = {
        prompt,
        profile: currentProfileName,
        conversation_id: currentConversation.conversationId,
        model_overrides: selectedOverrideModels.map(name => modelOverrideMap[name]),
        user_id: getUserId()
    };

    if (attachmentMetadata.length) {
        payload.attachments = attachmentMetadata;
    }

    // Show loading indicators for all models
    const loadingIds = {};
    selectedOverrideModels.forEach(modelName => {
        loadingIds[modelName] = showLoadingInMultiModelPane(multiModelGroupContainer, modelName);
    });

    try {
        console.log(`[${new Date().toISOString()}] Starting batch request for ${selectedOverrideModels.length} models`);

        const response = await fetch(`${API_URL}/chat/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API request failed (${response.status})`);
        }

        // Handle SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonData = line.substring(6);
                    const event = JSON.parse(jsonData);

                    if (event.type === 'metadata') {
                        console.log(`Batch request metadata:`, event);
                    } else if (event.type === 'result') {
                        const modelName = selectedOverrideModels[event.index];
                        console.log(`[${new Date().toISOString()}] Received response for ${modelName}`);

                        // Remove loading indicator
                        removeLoadingFromMultiModelPane(loadingIds[modelName]);

                        const routingTime = event.timing?.routing_time || 0;
                        const responseTime = event.timing?.inference_time || 0;

                        sessionStats.inputTokens += event.usage?.input_tokens || 0;
                        sessionStats.outputTokens += event.usage?.output_tokens || 0;
                        sessionStats.modelsUsed.add(event.model);
                        sessionStats.routingTimes = sessionStats.routingTimes || [];
                        sessionStats.responseTimes = sessionStats.responseTimes || [];
                        sessionStats.routingTimes.push(routingTime);
                        sessionStats.responseTimes.push(responseTime);
                        sessionStats.totalCost += Number(event.usage?.cost) || 0;

                        addResponseToMultiModelPane(multiModelGroupContainer, modelName, event.output, {
                            model: event.model,
                            provider: event.provider,
                            score: event.routing_metadata?.score,
                            routingTime: routingTime,
                            responseTime: responseTime,
                            inputTokens: event.usage?.input_tokens,
                            outputTokens: event.usage?.output_tokens
                        });

                        updateSessionStats();
                    } else if (event.type === 'error') {
                        const modelName = selectedOverrideModels[event.index];
                        console.error(`Error with model ${modelName}:`, event.error);
                        removeLoadingFromMultiModelPane(loadingIds[modelName]);

                        addResponseToMultiModelPane(multiModelGroupContainer, modelName, `Error: ${event.error}`, {
                            model: 'error',
                            provider: 'system'
                        });
                    } else if (event.type === 'done') {
                        console.log(`[${new Date().toISOString()}] All models completed`);
                    }
                }
            }
        }

        setLoading(false);
        promptInput?.focus();

    } catch (error) {
        console.error('Batch request error:', error);
        // Remove all loading indicators and show errors
        selectedOverrideModels.forEach(modelName => {
            removeLoadingFromMultiModelPane(loadingIds[modelName]);
            addResponseToMultiModelPane(multiModelGroupContainer, modelName, `Error: ${error.message}`, {
                model: 'error',
                provider: 'system'
            });
        });
        setLoading(false);
    }
}

// Create a multi-model response group container
function createMultiModelResponseGroup(modelNames) {
    const groupContainer = document.createElement('div');
    groupContainer.className = 'multi-model-group';
    groupContainer.dataset.modelCount = modelNames.length;

    modelNames.forEach(modelName => {
        const pane = document.createElement('div');
        pane.className = 'model-response-pane';
        pane.dataset.modelName = modelName;

        const header = document.createElement('div');
        header.className = 'model-pane-header';

        const model = allModels.find(m => m.name === modelName);
        if (model) {
            const logo = document.createElement('img');
            logo.src = model.logo;
            logo.alt = modelName;
            logo.style.transform = `scale(${model.logoScale})`;
            logo.draggable = false;
            header.appendChild(logo);
        }

        const title = document.createElement('h4');
        title.textContent = modelName;
        header.appendChild(title);

        const content = document.createElement('div');
        content.className = 'model-pane-content';

        pane.appendChild(header);
        pane.appendChild(content);
        groupContainer.appendChild(pane);
    });

    return groupContainer;
}

function showLoadingInMultiModelPane(groupContainer, modelName) {
    const loadingId = `loading-${modelName}-${Date.now()}`;
    const pane = groupContainer.querySelector(`.model-response-pane[data-model-name="${modelName}"]`);
    if (!pane) return loadingId;

    const content = pane.querySelector('.model-pane-content');
    if (!content) return loadingId;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML = `
        <div class="loading-dots">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
        </div>
        <span>Generating...</span>
    `;

    content.appendChild(loadingDiv);
    return loadingId;
}

function removeLoadingFromMultiModelPane(loadingId) {
    const loadingElement = document.getElementById(loadingId);
    if (loadingElement) {
        loadingElement.remove();
    }
}

function addResponseToMultiModelPane(groupContainer, modelName, content, metadata) {
    const pane = groupContainer.querySelector(`.model-response-pane[data-model-name="${modelName}"]`);
    if (!pane) return;

    const paneContent = pane.querySelector('.model-pane-content');
    if (!paneContent) return;

    const textDiv = document.createElement('div');
    textDiv.className = 'multi-model-text';

    const htmlContent = renderMarkdownAndLatex(content);
    textDiv.innerHTML = htmlContent;

    if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(textDiv, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false }
            ],
            throwOnError: false
        });
    }

    paneContent.appendChild(textDiv);

    if (metadata) {
        const footerDiv = document.createElement('div');
        footerDiv.className = 'multi-model-footer';

        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
        `;
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(content);
            copyButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                copyButton.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                `;
            }, 2000);
        });
        footerDiv.appendChild(copyButton);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'message-info';

        const routingTime = metadata.routingTime || metadata.routing_time_ms;
        if (routingTime) {
            const routingSpan = document.createElement('span');
            routingSpan.className = 'routing-latency';
            routingSpan.textContent = `${routingTime}ms`;
            infoDiv.appendChild(routingSpan);
        }

        const responseTime = metadata.responseTime || metadata.inference_time_ms;
        if (responseTime) {
            const responseSpan = document.createElement('span');
            responseSpan.className = 'response-latency';
            responseSpan.textContent = `${responseTime}ms`;
            infoDiv.appendChild(responseSpan);
        }

        footerDiv.appendChild(infoDiv);
        paneContent.appendChild(footerDiv);
    }

    currentConversation.messages.push({
        role: 'assistant',
        text: content,
        metadata,
        modelName
    });
}

function renderMultiModelGroup(groupedMessages) {
    if (!chatContainer) return;

    const modelNames = groupedMessages.map(msg => msg.model);
    const groupContainer = createMultiModelResponseGroup(modelNames);

    groupedMessages.forEach(msg => {
        addResponseToMultiModelPane(groupContainer, msg.model, msg.text, {
            model: msg.model,
            provider: msg.metadata?.provider,
            routingTime: msg.metadata?.routing_time_ms,
            responseTime: msg.metadata?.inference_time_ms,
            inputTokens: msg.metadata?.input_tokens,
            outputTokens: msg.metadata?.output_tokens
        });
    });

    chatContainer.appendChild(groupContainer);
}

function addMessage(role, content, metadata = null, attachments = []) {
    if (!chatContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;

    // Add model logo at the top for assistant messages
    if (role === 'assistant' && metadata && metadata.model) {
        const modelLogoMap = {
            'gpt': 'assets/chatgpt-logo.png',
            'claude': 'assets/claude-logo.png',
            'gemini': 'assets/gemini-logo.png',
            'qwen': 'assets/qwen-logo.png',
            'mistral': 'assets/mistral-logo.png',
            'perplexity': 'assets/perplexity-logo.png',
            'grok': 'assets/grok-logo.png',
            'deepseek': 'assets/deepseek-logo.png',
            'llama': 'assets/llama-logo.png'
        };

        let logoSrc = null;
        const modelLower = metadata.model.toLowerCase();
        for (const [key, value] of Object.entries(modelLogoMap)) {
            if (modelLower.includes(key)) {
                logoSrc = value;
                break;
            }
        }

        if (logoSrc) {
            const logoDiv = document.createElement('div');
            logoDiv.className = 'message-model-logo';
            const modelLogo = document.createElement('img');
            modelLogo.src = logoSrc;
            modelLogo.alt = metadata.model;
            modelLogo.draggable = false;
            logoDiv.appendChild(modelLogo);
            messageDiv.appendChild(logoDiv);
        }
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';

    // Render markdown and LaTeX
    const htmlContent = renderMarkdownAndLatex(content);
    textDiv.innerHTML = htmlContent;

    if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(textDiv, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false }
            ],
            throwOnError: false
        });
    }

    contentDiv.appendChild(textDiv);

    if (attachments && attachments.length) {
        const attachmentsDiv = document.createElement('div');
        attachmentsDiv.className = 'message-attachments';

        attachments.forEach(file => {
            const pill = document.createElement('div');
            pill.className = 'message-attachment';

            const clip = document.createElement('svg');
            clip.setAttribute('viewBox', '0 0 24 24');
            clip.setAttribute('fill', 'none');
            clip.setAttribute('stroke', '#8e3c2c');
            clip.setAttribute('stroke-width', '2');
            clip.setAttribute('stroke-linecap', 'round');
            clip.setAttribute('stroke-linejoin', 'round');
            clip.innerHTML = '<path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07L14.36 4.5a3.5 3.5 0 0 1 4.95 4.95L10 18.76a2 2 0 1 1-2.83-2.83L16.17 6.93"></path>';
            pill.appendChild(clip);

            const label = document.createElement('span');
            label.textContent = file.name || 'attachment';
            pill.appendChild(label);

            attachmentsDiv.appendChild(pill);
        });

        contentDiv.appendChild(attachmentsDiv);
    }

    // Add footer with copy button, latency and model name for assistant messages
    if (role === 'assistant' && metadata) {
        const footerDiv = document.createElement('div');
        footerDiv.className = 'message-footer';

        // Copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
        `;
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(content);
            copyButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                copyButton.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                `;
            }, 2000);
        });
        footerDiv.appendChild(copyButton);

        // Model name and latency
        const infoDiv = document.createElement('div');
        infoDiv.className = 'message-info';

        if (metadata.model) {
            const modelSpan = document.createElement('span');
            modelSpan.className = 'model-name';
            modelSpan.textContent = metadata.model;
            infoDiv.appendChild(modelSpan);
        }

        const routingTime = metadata.routingTime || metadata.routing_time_ms;
        if (routingTime) {
            const routingSpan = document.createElement('span');
            routingSpan.className = 'routing-latency';
            routingSpan.textContent = `Routing: ${routingTime}ms`;
            infoDiv.appendChild(routingSpan);
        }

        const responseTime = metadata.responseTime || metadata.inference_time_ms;
        if (responseTime) {
            const responseSpan = document.createElement('span');
            responseSpan.className = 'response-latency';
            responseSpan.textContent = `Response: ${responseTime}ms`;
            infoDiv.appendChild(responseSpan);
        }

        footerDiv.appendChild(infoDiv);
        contentDiv.appendChild(footerDiv);
    }

    messageDiv.appendChild(contentDiv);

    chatContainer.appendChild(messageDiv);

    // Store message in current conversation
    currentConversation.messages.push({
        role,
        text: content,
        metadata,
        attachments
    });
}

function showLoading() {
    const loadingId = `loading-${Date.now()}`;
    if (!chatContainer) return loadingId;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-assistant';
    messageDiv.id = loadingId;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = `
        <div class="wave-bars">
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
        </div>
    `;

    messageDiv.appendChild(loadingDiv);
    chatContainer.appendChild(messageDiv);

    return loadingId;
}

function updateLoadingWithModel(loadingId, modelName) {
    if (!loadingId) return;
    const loadingElement = document.getElementById(loadingId);
    if (!loadingElement) return;

    const modelLogoMap = {
        'gpt': { src: 'assets/chatgpt-logo.png', scale: '1.0' },
        'claude': { src: 'assets/claude-logo.png', scale: '2.88' },
        'gemini': { src: 'assets/gemini-logo.png', scale: '4.0' }
    };

    let logoInfo = null;
    const modelLower = modelName.toLowerCase();
    for (const [key, value] of Object.entries(modelLogoMap)) {
        if (modelLower.includes(key)) {
            logoInfo = value;
            break;
        }
    }

    if (logoInfo) {
        const logoDiv = document.createElement('div');
        logoDiv.className = 'message-model-logo';
        const modelLogo = document.createElement('img');
        modelLogo.src = logoInfo.src;
        modelLogo.alt = modelName;
        modelLogo.style.transform = `scale(${logoInfo.scale})`;
        modelLogo.draggable = false;
        logoDiv.appendChild(modelLogo);

        const loadingDiv = loadingElement.querySelector('.loading');
        if (loadingDiv) {
            loadingElement.insertBefore(logoDiv, loadingDiv);
            loadingDiv.innerHTML = `
                <div class="loading-dots">
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                </div>
                <span>Thinking...</span>
            `;
        }
    }
}

function removeLoading(loadingId) {
    if (!loadingId) return;
    const loadingElement = document.getElementById(loadingId);
    loadingElement?.remove();
}

function setLoading(state) {
    isLoading = state;
    if (sendButton) sendButton.disabled = state;
    if (promptInput) promptInput.disabled = state;
}

async function testConnection() {
    try {
        const response = await fetch(`${API_URL}/`);
        if (response.ok) {
            console.log('Backend connected');
        }
    } catch (error) {
        console.warn('Backend offline? Start FastAPI with: uvicorn app:app --reload', error);
    }
}

function initCostComparisonChart() {
    const ctx = document.getElementById('costComparisonChart');
    if (!ctx) return;

    // Model pricing comparison data (monthly cost for same workload)
    const models = [
        'Restruct Router',
        'GPT-5 Pro',
        'GPT-5',
        'GPT-5 Mini',
        'Claude Opus 4.1',
        'Claude Sonnet 4.5',
        'Claude Haiku 4.5',
        'Gemini 2.5 Pro',
        'Gemini 2.5 Flash'
    ];

    const costs = [
        12350,  // Restruct (optimized routing)
        28500,  // GPT-5 Pro (most expensive)
        24680,  // GPT-5
        18200,  // GPT-5 Mini
        26400,  // Opus 4.1
        22800,  // Sonnet 4.5
        15600,  // Haiku 4.5
        25100,  // Gemini 2.5 Pro
        19500   // Gemini 2.5 Flash
    ];

    // Color: Restruct is highlighted, others are neutral
    const backgroundColors = costs.map((_, i) =>
        i === 0 ? '#b56747' : 'rgba(92, 49, 30, 0.5)'
    );

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: models,
            datasets: [{
                label: 'Monthly Cost ($)',
                data: costs,
                backgroundColor: backgroundColors,
                borderColor: costs.map((_, i) =>
                    i === 0 ? '#8e3c2c' : 'rgba(92, 49, 30, 0.7)'
                ),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.y;
                            const savings = costs[0];
                            const diff = value - savings;
                            const percent = ((diff / value) * 100).toFixed(1);

                            if (context.dataIndex === 0) {
                                return `Monthly Cost: $${value.toLocaleString()}`;
                            }
                            return [
                                `Monthly Cost: $${value.toLocaleString()}`,
                                `Savings with Restruct: $${diff.toLocaleString()} (${percent}%)`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Space Grotesk',
                            size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(92, 49, 30, 0.08)'
                    },
                    ticks: {
                        font: {
                            family: 'Space Grotesk',
                            size: 11
                        },
                        callback: function (value) {
                            return '$' + (value / 1000).toFixed(0) + 'k';
                        }
                    }
                }
            }
        }
    });
}

function toggleCollapsible(event, contentId, toggleSelector) {
    const content = document.getElementById(contentId);
    const toggle = document.querySelector(toggleSelector);

    if (!content || !toggle) return;

    if (event && content.contains(event.target) && content.offsetHeight > 0) {
        return;
    }

    event?.preventDefault();

    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    const nextState = !isExpanded;

    content.style.maxHeight = nextState ? content.scrollHeight + 'px' : '0';
    toggle.setAttribute('aria-expanded', String(nextState));

    const icon = toggle.querySelector('.collapse-icon');
    if (icon) icon.textContent = nextState ? '▲' : '▼';
}

function toggleCostComparison(event) {
    toggleCollapsible(event, 'costComparisonContent', '.cost-comparison-section .collapse-toggle');
}



// Conversations Management
let conversations = [];
let currentConversation = {
    id: Date.now(),
    conversationId: null,  // Backend conversation ID
    messages: [],
    timestamp: new Date(),
    title: null
};

function truncateTitle(text, maxLength = 40) {
    const trimmed = text.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return trimmed.substring(0, maxLength).trim() + '...';
}

async function updateConversationTitle(conversationId, title) {
    const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ title })
    });
    return response.ok;
}

const conversationsModal = document.getElementById('conversationsModal');
const previousConversationsBtn = document.getElementById('previousConversationsBtn');
const closeConversationsModal = document.getElementById('closeConversationsModal');
const newConversationBtn = document.getElementById('newConversationBtn');
const conversationsList = document.getElementById('conversationsList');

function formatTimestamp(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderConversations() {
    if (conversations.length === 0) {
        conversationsList.innerHTML = `
            <div class="empty-conversations">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(92, 49, 30, 0.3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <p style="margin: 12px 0 0 0; color: rgba(92, 49, 30, 0.5); font-size: 14px;">No previous conversations</p>
            </div>
        `;
        return;
    }

    conversationsList.innerHTML = conversations
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(conv => `
            <div class="conversation-item" data-conversation-id="${conv.conversationId || conv.id}">
                <div class="conversation-item-header">
                    <span class="conversation-timestamp">${formatTimestamp(conv.timestamp)}</span>
                </div>
                <div class="conversation-summary">
                    ${conv.title || (conv.messages.length > 0 ? conv.messages[0].text : 'Empty conversation')}
                </div>
            </div>
        `).join('');

    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
            const convId = item.dataset.conversationId;
            loadConversation(convId);
        });
    });
}

async function loadConversation(conversationId) {
    const conversation = conversations.find(c => c.id === conversationId || c.conversationId === conversationId);
    if (!conversation) return;

    // Remove all messages and multi-model groups but keep chat-controls
    const messages = chatContainer.querySelectorAll('.message');
    const multiModelGroups = chatContainer.querySelectorAll('.multi-model-group');
    const welcomeMsg = chatContainer.querySelector('.welcome-message');

    messages.forEach(msg => msg.remove());
    multiModelGroups.forEach(group => group.remove());
    if (welcomeMsg) welcomeMsg.remove();

    // Load messages from backend if we have a backend conversation ID
    const backendId = conversation.conversationId || conversationId;
    let messagesToLoad = conversation.messages;

    if (backendId && typeof backendId === 'string' && backendId.includes('-')) {
        // Looks like a UUID - fetch from backend
        const backendMessages = await loadConversationMessagesFromBackend(backendId);
        if (backendMessages.length > 0) {
            messagesToLoad = backendMessages;
        }
    }

    currentConversation = {
        id: conversation.id,
        conversationId: backendId,
        messages: [],
        timestamp: conversation.timestamp
    };

    // Reset stats and load from stored conversation stats
    resetSessionStats();

    // Use stored stats if available
    if (conversation.stats) {
        sessionStats.inputTokens = conversation.stats.input_tokens || 0;
        sessionStats.outputTokens = conversation.stats.output_tokens || 0;
        sessionStats.totalCost = conversation.stats.total_cost || 0;
        (conversation.stats.models_used || []).forEach(m => sessionStats.modelsUsed.add(m));
        sessionStats.routingTimes = conversation.stats.routing_times || [];
        sessionStats.responseTimes = conversation.stats.response_times || [];
    }

    let i = 0;
    while (i < messagesToLoad.length) {
        const msg = messagesToLoad[i];

        if (msg.role === 'user') {
            addMessage('user', msg.text, msg.metadata, msg.attachments || []);
            i++;
            continue;
        }

        if (msg.message_group_id) {
            const groupId = msg.message_group_id;
            const groupedMessages = [];

            while (i < messagesToLoad.length &&
                   messagesToLoad[i].message_group_id === groupId) {
                groupedMessages.push(messagesToLoad[i]);
                i++;
            }

            renderMultiModelGroup(groupedMessages);
        } else {
            addMessage('assistant', msg.text, msg.metadata, msg.attachments || []);
            i++;
        }
    }
    updateSessionStats();

    conversations = conversations.filter(c => c.id !== conversationId && c.conversationId !== conversationId);

    conversationsModal.classList.remove('active');
}

function saveCurrentConversation() {
    if (currentConversation.messages.length > 0) {
        conversations.push({
            ...currentConversation,
            timestamp: currentConversation.timestamp
        });
    }
}

function startNewConversation() {
    saveCurrentConversation();

    currentConversation = {
        id: Date.now(),
        conversationId: null,  // Reset backend conversation ID
        messages: [],
        timestamp: new Date(),
        title: null
    };

    // Reset conversation stats
    resetSessionStats();

    // Disable split screen mode if active
    if (chatContainer.classList.contains('split-mode')) {
        chatContainer.classList.remove('split-mode');
        chatContainer.innerHTML = '';
    }

    // Remove all messages and multi-model groups but keep chat-controls
    const messages = chatContainer.querySelectorAll('.message');
    const multiModelGroups = chatContainer.querySelectorAll('.multi-model-group');
    const welcomeMsg = chatContainer.querySelector('.welcome-message');

    messages.forEach(msg => msg.remove());
    multiModelGroups.forEach(group => group.remove());
    if (welcomeMsg) welcomeMsg.remove();

    // Add fresh welcome message after chat-controls
    const chatControls = chatContainer.querySelector('.chat-controls');
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
        <img src="assets/logo.png" alt="" class="logo-mark ghost">
        <h3>Welcome to Restruct</h3>
    `;

    if (chatControls) {
        chatControls.insertAdjacentElement('afterend', welcomeDiv);
    } else {
        chatContainer.appendChild(welcomeDiv);
    }

    if (promptInput) {
        promptInput.value = '';
        promptInput.focus();
    }
}

if (previousConversationsBtn) {
    previousConversationsBtn.addEventListener('click', () => {
        renderConversations();
        conversationsModal.classList.add('active');
    });
}

if (closeConversationsModal) {
    closeConversationsModal.addEventListener('click', () => {
        conversationsModal.classList.remove('active');
    });
}

if (conversationsModal) {
    conversationsModal.addEventListener('click', (e) => {
        if (e.target === conversationsModal) {
            conversationsModal.classList.remove('active');
        }
    });
}

if (newConversationBtn) {
    newConversationBtn.addEventListener('click', () => {
        startNewConversation();
    });
}

// =============================================================================
// BACKEND CONVERSATION PERSISTENCE
// =============================================================================

async function loadConversationsFromBackend() {
    const userId = getUserId();
    if (!userId) return;

    const response = await fetch(`${API_URL}/conversations?user_id=${userId}`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) return;

    const data = await response.json();

    // Convert backend conversations to frontend format
    conversations = (data.conversations || []).map(conv => ({
        id: conv.id,
        conversationId: conv.id,  // Backend ID
        messages: [],  // Messages loaded on demand
        timestamp: new Date(conv.created_at),
        title: conv.title || 'Untitled',
        stats: conv.stats || null
    }));
}

async function loadConversationMessagesFromBackend(conversationId) {
    const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) return [];

    const data = await response.json();

    return (data.messages || []).map(msg => ({
        role: msg.role,
        text: msg.content,
        model: msg.model,
        metadata: msg.model ? {
            model: msg.model,
            provider: msg.provider,
            ...msg.metadata
        } : null,
        attachments: [],
        message_group_id: msg.message_group_id
    }));
}

// =============================================================================
// END BACKEND CONVERSATION PERSISTENCE
// =============================================================================

// Profile Selector Modal
const profileSelectorModal = document.getElementById('profileSelectorModal');
const currentProfileIndicator = document.getElementById('currentProfileIndicator');
const closeProfileSelectorModal = document.getElementById('closeProfileSelectorModal');
const profileSelectorList = document.getElementById('profileSelectorList');

function renderProfileSelector() {
    if (!profileSelectorList) return;

    profileSelectorList.innerHTML = '';

    // Get all profile cards to extract display names
    const profileCards = document.querySelectorAll('.profile-card');
    const profilesArray = [];

    profileCards.forEach(card => {
        const profileName = card.dataset.profile;
        const displayName = card.dataset.profileLabel || profileName;
        const profileData = profiles[profileName];

        if (profileData) {
            profilesArray.push({
                name: profileName,
                displayName: displayName,
                description: profileData.description || 'Custom profile'
            });
        }
    });

    profilesArray.forEach(profile => {
        const isActive = profile.name === currentProfileName;
        const item = document.createElement('div');
        item.className = `profile-selector-item ${isActive ? 'active' : ''}`;
        item.dataset.profile = profile.name;

        item.innerHTML = `
            <div class="profile-selector-item-info">
                <div class="profile-selector-item-name">${profile.displayName}</div>
                <div class="profile-selector-item-desc">${profile.description}</div>
            </div>
            <div class="profile-selector-item-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
        `;

        item.addEventListener('click', () => {
            setActiveProfile(profile.name);
            profileSelectorModal.classList.remove('active');
        });

        profileSelectorList.appendChild(item);
    });
}

if (currentProfileIndicator) {
    currentProfileIndicator.addEventListener('click', () => {
        renderProfileSelector();
        profileSelectorModal.classList.add('active');
    });
}

if (closeProfileSelectorModal) {
    closeProfileSelectorModal.addEventListener('click', () => {
        profileSelectorModal.classList.remove('active');
    });
}

if (profileSelectorModal) {
    profileSelectorModal.addEventListener('click', (e) => {
        if (e.target === profileSelectorModal) {
            profileSelectorModal.classList.remove('active');
        }
    });
}

// API Key Management
let activeApiKeys = [];
let currentPendingKey = null;
let currentPendingKeyDate = null;

const generateKeyBtn = document.getElementById('generateKeyBtn');
const activateKeyBtn = document.getElementById('activateKeyBtn');
const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');
const copyKeyBtn = document.getElementById('copyKeyBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiKeyName = document.getElementById('apiKeyName');
const noKeyState = document.getElementById('noKeyState');
const keyActiveState = document.getElementById('keyActiveState');
const keyCreatedDate = document.getElementById('keyCreatedDate');
const activeKeysList = document.getElementById('activeKeysList');

function generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'rst_';
    for (let i = 0; i < 48; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

function showPendingKey(key) {
    currentPendingKey = key;
    currentPendingKeyDate = new Date();

    if (apiKeyInput) {
        apiKeyInput.value = key;
        apiKeyInput.type = 'password';
    }

    if (apiKeyName) {
        apiKeyName.value = '';
    }

    if (keyCreatedDate) {
        keyCreatedDate.textContent = `Created: ${currentPendingKeyDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    }

    if (noKeyState) {
        noKeyState.style.display = 'none';
    }

    if (keyActiveState) {
        keyActiveState.style.display = 'flex';
    }
}

function resetKeyGeneration() {
    currentPendingKey = null;
    currentPendingKeyDate = null;

    if (apiKeyInput) {
        apiKeyInput.value = '';
        apiKeyInput.type = 'password';
    }

    if (apiKeyName) {
        apiKeyName.value = '';
    }

    if (noKeyState) {
        noKeyState.style.display = 'flex';
    }

    if (keyActiveState) {
        keyActiveState.style.display = 'none';
    }
}

function renderActiveKeys() {
    if (!activeKeysList) return;

    if (activeApiKeys.length === 0) {
        activeKeysList.innerHTML = `
            <div class="empty-keys-state">
                <p style="margin: 0; color: var(--text-muted); font-size: 14px;">No active keys yet</p>
            </div>
        `;
        return;
    }

    activeKeysList.innerHTML = '';

    activeApiKeys.forEach((keyData, index) => {
        const keyItem = document.createElement('div');
        keyItem.className = 'active-key-item';

        keyItem.innerHTML = `
            <div class="active-key-header">
                <div>
                    <h4 class="active-key-name">${keyData.name}</h4>
                    <span class="active-key-date">Created: ${keyData.createdDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}</span>
                </div>
                <button class="active-key-revoke-btn" data-index="${index}" data-name="${keyData.name}">
                    Revoke
                </button>
            </div>
            <div class="active-key-value">
                <input type="text" class="active-key-input" data-key="${keyData.key}" data-name="${keyData.name}" value="${keyData.name}" readonly>
                <button class="key-action-btn active-key-reveal-btn" data-index="${index}" data-revealed="false" title="Reveal Key">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
                <button class="key-action-btn active-key-copy-btn" data-key="${keyData.key}" title="Copy to Clipboard">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
            </div>
            <div class="active-key-stats">
                <div class="active-key-stat">
                    <div class="active-key-stat-label">Last Used</div>
                    <div class="active-key-stat-value">${keyData.lastUsed || 'Never'}</div>
                </div>
                <div class="active-key-stat">
                    <div class="active-key-stat-label">Total Requests</div>
                    <div class="active-key-stat-value">${keyData.requestCount || 0}</div>
                </div>
            </div>
        `;

        activeKeysList.appendChild(keyItem);
    });
}

// Use event delegation for better reliability
if (activeKeysList) {
    activeKeysList.addEventListener('click', async (e) => {
        // Handle reveal button clicks
        const revealBtn = e.target.closest('.active-key-reveal-btn');
        if (revealBtn) {
            const keyInput = revealBtn.parentElement.querySelector('.active-key-input');
            const isRevealed = revealBtn.dataset.revealed === 'true';

            if (isRevealed) {
                // Hide key, show name
                keyInput.value = keyInput.dataset.name;
                revealBtn.dataset.revealed = 'false';
                revealBtn.title = 'Reveal Key';
                revealBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                `;
            } else {
                // Show key, hide name
                keyInput.value = keyInput.dataset.key;
                revealBtn.dataset.revealed = 'true';
                revealBtn.title = 'Hide Key';
                revealBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                `;
            }
            return;
        }

        // Handle copy button clicks
        const copyBtn = e.target.closest('.active-key-copy-btn');
        if (copyBtn) {
            const key = copyBtn.dataset.key;
            try {
                await navigator.clipboard.writeText(key);
                const originalHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                setTimeout(() => {
                    copyBtn.innerHTML = originalHtml;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
            return;
        }

        // Handle revoke button clicks
        const revokeBtn = e.target.closest('.active-key-revoke-btn');
        if (revokeBtn) {
            const index = parseInt(revokeBtn.dataset.index);
            const keyName = revokeBtn.dataset.name;
            showRevokeModal(index, keyName);
            return;
        }
    });
}

// Revoke modal functionality
const revokeKeyModal = document.getElementById('revokeKeyModal');
const revokeKeyNameEl = document.getElementById('revokeKeyName');
const cancelRevokeBtn = document.getElementById('cancelRevokeBtn');
const confirmRevokeBtn = document.getElementById('confirmRevokeBtn');
let pendingRevokeIndex = null;

function showRevokeModal(index, keyName) {
    pendingRevokeIndex = index;
    if (revokeKeyNameEl) {
        revokeKeyNameEl.textContent = `"${keyName}"`;
    }
    if (revokeKeyModal) {
        revokeKeyModal.classList.add('active');
    }
}

function hideRevokeModal() {
    pendingRevokeIndex = null;
    if (revokeKeyModal) {
        revokeKeyModal.classList.remove('active');
    }
}

if (cancelRevokeBtn) {
    cancelRevokeBtn.addEventListener('click', () => {
        hideRevokeModal();
    });
}

if (confirmRevokeBtn) {
    confirmRevokeBtn.addEventListener('click', () => {
        if (pendingRevokeIndex !== null) {
            activeApiKeys.splice(pendingRevokeIndex, 1);
            renderActiveKeys();
            hideRevokeModal();
        }
    });
}

if (revokeKeyModal) {
    revokeKeyModal.addEventListener('click', (e) => {
        if (e.target === revokeKeyModal) {
            hideRevokeModal();
        }
    });
}

if (generateKeyBtn) {
    generateKeyBtn.addEventListener('click', () => {
        const newKey = generateApiKey();
        showPendingKey(newKey);
    });
}

if (activateKeyBtn) {
    activateKeyBtn.addEventListener('click', () => {
        if (!currentPendingKey) return;

        const keyName = apiKeyName?.value.trim() || 'Unnamed Key';

        activeApiKeys.push({
            name: keyName,
            key: currentPendingKey,
            createdDate: currentPendingKeyDate,
            lastUsed: null,
            requestCount: 0
        });

        renderActiveKeys();
        resetKeyGeneration();
    });
}

if (toggleKeyVisibility) {
    toggleKeyVisibility.addEventListener('click', () => {
        if (apiKeyInput) {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                toggleKeyVisibility.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                `;
            } else {
                apiKeyInput.type = 'password';
                toggleKeyVisibility.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                `;
            }
        }
    });
}

if (copyKeyBtn) {
    copyKeyBtn.addEventListener('click', async () => {
        if (currentPendingKey) {
            try {
                await navigator.clipboard.writeText(currentPendingKey);

                const originalHtml = copyKeyBtn.innerHTML;
                copyKeyBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;

                setTimeout(() => {
                    copyKeyBtn.innerHTML = originalHtml;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    });
}

// Focus Mode
const enterFocusBtn = document.getElementById('enterFocusBtn');
const exitFocusBtn = document.getElementById('exitFocusBtn');

// Conversation Stats Toggle
const statsToggleBtn = document.getElementById('statsToggleBtn');
const conversationStatsSidebar = document.getElementById('conversationStatsSidebar');

if (enterFocusBtn) {
    enterFocusBtn.addEventListener('click', () => {
        document.body.classList.add('focus-mode');
        if (conversationStatsSidebar) {
            conversationStatsSidebar.classList.add('collapsed');
        }
    });
}

if (exitFocusBtn) {
    exitFocusBtn.addEventListener('click', () => {
        document.body.classList.remove('focus-mode');
        if (conversationStatsSidebar) {
            conversationStatsSidebar.classList.remove('collapsed');
        }
    });
}

if (statsToggleBtn && conversationStatsSidebar) {
    statsToggleBtn.addEventListener('click', () => {
        conversationStatsSidebar.classList.toggle('collapsed');
    });
}

// Model Marketplace
function populateMarketplace(sortBy = 'score-desc') {
    let modelsData = [
        // OpenAI Models
        {
            name: "GPT-5",
            provider: "OpenAI",
            logo: "assets/chatgpt-logo.png",
            inputCost: 1.25,
            outputCost: 10.0,
            maxTokens: "128K",
            capabilities: {
                "Overall Complexity": 10.0,
                "Math & Logic": 10.0,
                "Creative & Linguistic": 9.5,
                "Factuality": 9.5,
                "Chain of Thought": 9.4
            }
        },
        {
            name: "GPT-5 Mini",
            provider: "OpenAI",
            logo: "assets/chatgpt-logo.png",
            inputCost: 0.60,
            outputCost: 4.5,
            maxTokens: "128K",
            capabilities: {
                "Overall Complexity": 7.1,
                "Math & Logic": 6.8,
                "Creative & Linguistic": 7.4,
                "Factuality": 7.1,
                "Chain of Thought": 6.6
            }
        },
        {
            name: "GPT-5 Nano",
            provider: "OpenAI",
            logo: "assets/chatgpt-logo.png",
            inputCost: 0.25,
            outputCost: 2.0,
            maxTokens: "128K",
            capabilities: {
                "Overall Complexity": 5.7,
                "Math & Logic": 5.1,
                "Creative & Linguistic": 6.2,
                "Factuality": 5.7,
                "Chain of Thought": 4.9
            }
        },
        // Google Models
        {
            name: "Gemini 2.5 Pro",
            provider: "Google",
            logo: "assets/gemini-logo.png",
            inputCost: 1.25,
            outputCost: 10.0,
            maxTokens: "1M",
            capabilities: {
                "Overall Complexity": 9.6,
                "Math & Logic": 9.0,
                "Creative & Linguistic": 8.6,
                "Factuality": 9.1,
                "Chain of Thought": 9.4
            }
        },
        {
            name: "Gemini 2.5 Flash",
            provider: "Google",
            logo: "assets/gemini-logo.png",
            inputCost: 0.30,
            outputCost: 2.50,
            maxTokens: "1M",
            capabilities: {
                "Overall Complexity": 6.9,
                "Math & Logic": 5.8,
                "Creative & Linguistic": 7.1,
                "Factuality": 6.2,
                "Chain of Thought": 6.1
            }
        },
        {
            name: "Gemini 2.5 Flash Lite",
            provider: "Google",
            logo: "assets/gemini-logo.png",
            inputCost: 0.10,
            outputCost: 0.40,
            maxTokens: "1M",
            capabilities: {
                "Overall Complexity": 2.6,
                "Math & Logic": 2.1,
                "Creative & Linguistic": 2.9,
                "Factuality": 2.4,
                "Chain of Thought": 1.6
            }
        },
        {
            name: "Gemini 2.0 Flash",
            provider: "Google",
            logo: "assets/gemini-logo.png",
            inputCost: 0.15,
            outputCost: 0.60,
            maxTokens: "512K",
            capabilities: {
                "Overall Complexity": 4.1,
                "Math & Logic": 3.6,
                "Creative & Linguistic": 4.2,
                "Factuality": 4.0,
                "Chain of Thought": 3.6
            }
        },
        {
            name: "Gemini 2.0 Flash Lite",
            provider: "Google",
            logo: "assets/gemini-logo.png",
            inputCost: 0.05,
            outputCost: 0.20,
            maxTokens: "512K",
            capabilities: {
                "Overall Complexity": 1.0,
                "Math & Logic": 1.0,
                "Creative & Linguistic": 1.0,
                "Factuality": 1.0,
                "Chain of Thought": 1.0
            }
        },
        // Anthropic Models
        {
            name: "Claude Opus 4.1",
            provider: "Anthropic",
            logo: "assets/claude-logo.png",
            inputCost: 15.0,
            outputCost: 75.0,
            maxTokens: "200K",
            capabilities: {
                "Overall Complexity": 9.1,
                "Math & Logic": 8.6,
                "Creative & Linguistic": 10.0,
                "Factuality": 10.0,
                "Chain of Thought": 10.0
            }
        },
        {
            name: "Claude Sonnet 4.5",
            provider: "Anthropic",
            logo: "assets/claude-logo.png",
            inputCost: 3.0,
            outputCost: 15.0,
            maxTokens: "200K",
            capabilities: {
                "Overall Complexity": 8.0,
                "Math & Logic": 7.1,
                "Creative & Linguistic": 9.0,
                "Factuality": 8.4,
                "Chain of Thought": 8.6
            }
        },
        {
            name: "Claude Haiku 4.5",
            provider: "Anthropic",
            logo: "assets/claude-logo.png",
            inputCost: 0.8,
            outputCost: 4.0,
            maxTokens: "200K",
            capabilities: {
                "Overall Complexity": 4.1,
                "Math & Logic": 4.5,
                "Creative & Linguistic": 8.4,
                "Factuality": 7.1,
                "Chain of Thought": 4.6
            }
        }
    ];

    const grid = document.getElementById('marketplaceModelsGrid');
    if (!grid) return;

    // Sort models based on selected option
    modelsData.sort((a, b) => {
        const aScores = Object.values(a.capabilities);
        const bScores = Object.values(b.capabilities);
        const aAvgScore = aScores.reduce((sum, val) => sum + val, 0) / aScores.length;
        const bAvgScore = bScores.reduce((sum, val) => sum + val, 0) / bScores.length;
        const aAvgCost = (a.inputCost + a.outputCost) / 2;
        const bAvgCost = (b.inputCost + b.outputCost) / 2;

        switch (sortBy) {
            case 'score-desc':
                return bAvgScore - aAvgScore;
            case 'score-asc':
                return aAvgScore - bAvgScore;
            case 'cost-asc':
                return aAvgCost - bAvgCost;
            case 'cost-desc':
                return bAvgCost - aAvgCost;
            case 'name-asc':
                return a.name.localeCompare(b.name);
            default:
                return 0;
        }
    });

    grid.innerHTML = modelsData.map(model => {
        // Get logo scale based on provider (1.2x larger)
        let logoScale = '1.0';
        if (model.logo.includes('chatgpt')) logoScale = '0.9';
        else if (model.logo.includes('claude')) logoScale = '2.592';
        else if (model.logo.includes('gemini')) logoScale = '3.6';

        // Calculate average score
        const scores = Object.values(model.capabilities);
        const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);

        const capabilitiesHTML = Object.entries(model.capabilities).map(([key, value]) => {
            const percentage = (value / 10) * 100;
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const barColor = isDark
                ? (value >= 8 ? '#e88873' : value >= 5 ? '#f5b899' : '#f5d4b8')
                : (value >= 8 ? '#8e3c2c' : value >= 5 ? '#c98454' : '#d4a574');
            const labelColor = isDark ? '#c9a38a' : '#5b2a1a';
            const valueColor = isDark ? '#f5b899' : '#8e3c2c';
            const barBg = isDark ? 'rgba(201, 163, 138, 0.2)' : 'rgba(142, 60, 44, 0.1)';
            return `
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span style="font-size: 10px; color: ${labelColor}; font-weight: 500;">${key}</span>
                        <span style="font-size: 10px; color: ${valueColor}; font-weight: 600;">${value.toFixed(1)}</span>
                    </div>
                    <div style="width: 100%; height: 5px; background: ${barBg}; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${percentage}%; height: 100%; background: ${barColor}; transition: width 0.3s;"></div>
                    </div>
                </div>
            `;
        }).join('');

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const pricingHeadingColor = isDark ? 'rgba(201, 163, 138, 0.7)' : 'rgba(43, 29, 20, 0.5)';
        const pricingLabelColor = isDark ? 'rgba(201, 163, 138, 0.8)' : 'rgba(92, 49, 30, 0.6)';
        const pricingValueColor = isDark ? '#f5b899' : '#8e3c2c';
        const pricingBgColor = isDark ? 'rgba(201, 163, 138, 0.12)' : 'rgba(142, 60, 44, 0.05)';
        const pricingBorderColor = isDark ? 'rgba(201, 163, 138, 0.2)' : 'rgba(142, 60, 44, 0.1)';
        const maxTokensColor = isDark ? 'rgba(201, 163, 138, 0.7)' : 'rgba(92, 49, 30, 0.5)';
        const scoreColor = isDark ? '#f5b899' : '#8e3c2c';
        const scoreLabelColor = isDark ? 'rgba(201, 163, 138, 0.7)' : 'rgba(92, 49, 30, 0.5)';

        return `
            <div style="background: var(--bg-elevated); border-radius: 14px; border: 2px solid var(--border-subtle); padding: 16px; transition: all 0.2s; cursor: default;">
                <div style="display: grid; grid-template-columns: 60px 1fr 60px; align-items: center; padding: 8px 0 16px 0; margin-bottom: 14px; height: 36px;">
                    <div></div>
                    <div style="display: flex; justify-content: center;">
                        <img src="${model.logo}" alt="${model.provider}" style="width: 108px; height: 36px; object-fit: contain; transform: scale(${logoScale});" draggable="false">
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <span style="font-size: 9px; font-weight: 500; color: ${scoreLabelColor}; text-transform: uppercase; letter-spacing: 0.05em;">Score</span>
                        <span style="font-size: 16px; font-weight: 700; color: ${scoreColor};">${avgScore}</span>
                    </div>
                </div>

                <div style="margin-bottom: 12px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: var(--text-primary); text-align: center;">${model.name}</h4>
                    ${capabilitiesHTML}
                </div>

                <div style="padding-top: 12px; border-top: 1px solid ${pricingBorderColor};">
                    <h4 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: ${pricingHeadingColor};">Pricing</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="background: ${pricingBgColor}; padding: 8px 10px; border-radius: 8px;">
                            <p style="margin: 0 0 3px 0; font-size: 10px; color: ${pricingLabelColor}; font-weight: 500;">Input</p>
                            <p style="margin: 0; font-size: 13px; font-weight: 600; color: ${pricingValueColor};">$${model.inputCost.toFixed(2)}/M</p>
                        </div>
                        <div style="background: ${pricingBgColor}; padding: 8px 10px; border-radius: 8px;">
                            <p style="margin: 0 0 3px 0; font-size: 10px; color: ${pricingLabelColor}; font-weight: 500;">Output</p>
                            <p style="margin: 0; font-size: 13px; font-weight: 600; color: ${pricingValueColor};">$${model.outputCost.toFixed(2)}/M</p>
                        </div>
                    </div>
                    <div style="margin-top: 8px; text-align: center;">
                        <span style="font-size: 10px; color: ${maxTokensColor};">Max tokens: ${model.maxTokens}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Model Override
let selectedOverrideModel = null;

const allModels = [
    { name: "GPT-5", provider: "OpenAI", logo: "assets/chatgpt-logo.png", logoScale: "1.08", score: 9.7 },
    { name: "GPT-5 Mini", provider: "OpenAI", logo: "assets/chatgpt-logo.png", logoScale: "1.08", score: 7.0 },
    { name: "GPT-5 Nano", provider: "OpenAI", logo: "assets/chatgpt-logo.png", logoScale: "1.08", score: 5.5 },
    { name: "Gemini 2.5 Pro", provider: "Google", logo: "assets/gemini-logo.png", logoScale: "3.6", score: 9.1 },
    { name: "Gemini 2.5 Flash", provider: "Google", logo: "assets/gemini-logo.png", logoScale: "3.6", score: 6.6 },
    { name: "Gemini 2.5 Flash Lite", provider: "Google", logo: "assets/gemini-logo.png", logoScale: "3.6", score: 2.4 },
    { name: "Gemini 2.0 Flash", provider: "Google", logo: "assets/gemini-logo.png", logoScale: "3.6", score: 3.9 },
    { name: "Gemini 2.0 Flash Lite", provider: "Google", logo: "assets/gemini-logo.png", logoScale: "3.6", score: 1.0 },
    { name: "Claude Opus 4.1", provider: "Anthropic", logo: "assets/claude-logo.png", logoScale: "2.592", score: 9.5 },
    { name: "Claude Sonnet 4.5", provider: "Anthropic", logo: "assets/claude-logo.png", logoScale: "2.592", score: 8.2 },
    { name: "Claude Haiku 4.5", provider: "Anthropic", logo: "assets/claude-logo.png", logoScale: "2.592", score: 5.7 }
];

const modelOverrideMap = {
    "GPT-5": "openai:gpt-5",
    "GPT-5 Mini": "openai:gpt-5-mini",
    "GPT-5 Nano": "openai:gpt-5-nano",
    "Gemini 2.5 Pro": "google:gemini-2.5-pro",
    "Gemini 2.5 Flash": "google:gemini-2.5-flash",
    "Gemini 2.5 Flash Lite": "google:gemini-2.5-flash-lite",
    "Gemini 2.0 Flash": "google:gemini-2.0-flash",
    "Gemini 2.0 Flash Lite": "google:gemini-2.0-flash-lite",
    "Claude Opus 4.1": "anthropic:claude-opus-4-1",
    "Claude Sonnet 4.5": "anthropic:claude-sonnet-4-5",
    "Claude Haiku 4.5": "anthropic:claude-haiku-4-5"
};

function populateModelOverrideList(searchTerm = '') {
    const modelList = document.getElementById('modelOverrideList');
    if (!modelList) return;

    const filteredModels = allModels.filter(model =>
        model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchTerm.toLowerCase())
    );

    modelList.innerHTML = filteredModels.map(model => `
        <div class="model-override-card" data-model-name="${model.name}" style="background: var(--bg-elevated); border-radius: 12px; border: 2px solid var(--border-subtle); padding: 16px; cursor: pointer; transition: all 0.2s;">
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 12px; height: 40px;">
                <img src="${model.logo}" alt="${model.provider}" style="width: 80px; height: 40px; object-fit: contain; transform: scale(${model.logoScale});" draggable="false">
            </div>
            <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: var(--text-primary); text-align: center;">${model.name}</h4>
            <div style="display: flex; justify-content: center; align-items: center; gap: 4px;">
                <span style="font-size: 11px; font-weight: 500; color: var(--text-muted);">Score:</span>
                <span style="font-size: 14px; font-weight: 700; color: var(--accent-primary);">${model.score}</span>
            </div>
        </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.model-override-card').forEach(card => {
        card.addEventListener('click', () => {
            const modelName = card.dataset.modelName;
            selectOverrideModel(modelName);
        });

        card.addEventListener('mouseenter', () => {
            card.style.borderColor = 'var(--accent-primary)';
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 4px 12px rgba(216, 162, 133, 0.2)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.borderColor = 'var(--border-subtle)';
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
        });
    });
}

// Support multiple model overrides (up to 4)
let selectedOverrideModels = [];

function selectOverrideModel(modelName) {
    // Toggle model selection
    const index = selectedOverrideModels.indexOf(modelName);
    if (index > -1) {
        // Model already selected, remove it
        selectedOverrideModels.splice(index, 1);
    } else {
        // Add model if we haven't reached the limit
        if (selectedOverrideModels.length < 4) {
            selectedOverrideModels.push(modelName);
        } else {
            // Show a message that max 4 models can be selected
            return;
        }
    }

    updateOverrideDisplay();
    updateModelCardSelections();
}

function updateOverrideDisplay() {
    const countBadge = document.getElementById('overrideCountBadge');
    const selectedModelsDisplay = document.getElementById('selectedModelsDisplay');
    const selectedModelsList = document.getElementById('selectedModelsList');

    // Update count badge in toolbar
    if (countBadge) {
        if (selectedOverrideModels.length > 0) {
            countBadge.textContent = selectedOverrideModels.length;
            countBadge.style.display = 'flex';
        } else {
            countBadge.style.display = 'none';
        }
    }

    // Update selected models display in modal
    if (selectedModelsDisplay && selectedModelsList) {
        if (selectedOverrideModels.length > 0) {
            selectedModelsDisplay.style.display = 'block';
            selectedModelsList.innerHTML = selectedOverrideModels.map(name =>
                `<div class="selected-model-chip" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(142, 60, 44, 0.1); border: 1px solid rgba(142, 60, 44, 0.2); border-radius: 8px; font-size: 13px; color: var(--text-primary); font-weight: 500;">
                    <span>${name}</span>
                    <button onclick="removeOverrideModel('${name}')" style="background: none; border: none; padding: 0; margin: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #8e3c2c; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6L6 18M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>`
            ).join('');
        } else {
            selectedModelsDisplay.style.display = 'none';
        }
    }
}

function removeOverrideModel(modelName) {
    const index = selectedOverrideModels.indexOf(modelName);
    if (index > -1) {
        selectedOverrideModels.splice(index, 1);
    }
    updateOverrideDisplay();
    updateModelCardSelections();
}

// Make removeOverrideModel available globally for onclick handlers
window.removeOverrideModel = removeOverrideModel;

function updateModelCardSelections() {
    document.querySelectorAll('.model-override-card').forEach(card => {
        const modelName = card.dataset.modelName;
        if (selectedOverrideModels.includes(modelName)) {
            card.style.borderColor = 'var(--accent-primary)';
            card.style.background = 'var(--accent-bg-subtle)';
        } else {
            card.style.borderColor = 'var(--border-subtle)';
            card.style.background = 'var(--bg-elevated)';
        }
    });
}

function clearOverrideModel() {
    selectedOverrideModels = [];
    updateOverrideDisplay();
    updateModelCardSelections();
}

function populateTracking(selectedProfile = 'all') {
    const allTrackingData = {
        'all': [
            { name: 'GPT-5', provider: 'OpenAI', logo: 'assets/chatgpt-logo.png', logoScale: '0.9', inputTokens: 145230, outputTokens: 89450, totalCost: 12.45, requestCount: 342 },
            { name: 'GPT-5 Mini', provider: 'OpenAI', logo: 'assets/chatgpt-logo.png', logoScale: '0.9', inputTokens: 234520, outputTokens: 156780, totalCost: 8.92, requestCount: 589 },
            { name: 'GPT-5 Nano', provider: 'OpenAI', logo: 'assets/chatgpt-logo.png', logoScale: '0.9', inputTokens: 98760, outputTokens: 67230, totalCost: 2.15, requestCount: 234 },
            { name: 'Gemini 2.5 Flash Lite', provider: 'Google', logo: 'assets/gemini-logo.png', logoScale: '3.6', inputTokens: 456890, outputTokens: 298450, totalCost: 5.67, requestCount: 823 },
            { name: 'Gemini 2.5 Flash', provider: 'Google', logo: 'assets/gemini-logo.png', logoScale: '3.6', inputTokens: 189340, outputTokens: 123670, totalCost: 4.23, requestCount: 412 },
            { name: 'Gemini 2.5 Pro', provider: 'Google', logo: 'assets/gemini-logo.png', logoScale: '3.6', inputTokens: 78560, outputTokens: 52340, totalCost: 6.89, requestCount: 156 },
            { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', logo: 'assets/claude-logo.png', logoScale: '2.592', inputTokens: 234670, outputTokens: 167890, totalCost: 15.34, requestCount: 478 },
            { name: 'Claude 3.5 Haiku', provider: 'Anthropic', logo: 'assets/claude-logo.png', logoScale: '2.592', inputTokens: 345210, outputTokens: 234560, totalCost: 7.21, requestCount: 612 }
        ],
        'default': [
            { name: 'GPT-5', provider: 'OpenAI', logo: 'assets/chatgpt-logo.png', logoScale: '0.9', inputTokens: 45230, outputTokens: 29450, totalCost: 4.12, requestCount: 112 },
            { name: 'Gemini 2.5 Flash', provider: 'Google', logo: 'assets/gemini-logo.png', logoScale: '3.6', inputTokens: 89340, outputTokens: 63670, totalCost: 2.45, requestCount: 198 },
            { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', logo: 'assets/claude-logo.png', logoScale: '2.592', inputTokens: 134670, outputTokens: 97890, totalCost: 8.91, requestCount: 256 }
        ],
        'cost-optimized': [
            { name: 'GPT-5 Mini', provider: 'OpenAI', logo: 'assets/chatgpt-logo.png', logoScale: '0.9', inputTokens: 134520, outputTokens: 96780, totalCost: 4.23, requestCount: 312 },
            { name: 'GPT-5 Nano', provider: 'OpenAI', logo: 'assets/chatgpt-logo.png', logoScale: '0.9', inputTokens: 98760, outputTokens: 67230, totalCost: 2.15, requestCount: 234 },
            { name: 'Gemini 2.5 Flash Lite', provider: 'Google', logo: 'assets/gemini-logo.png', logoScale: '3.6', inputTokens: 356890, outputTokens: 218450, totalCost: 3.89, requestCount: 567 },
            { name: 'Claude 3.5 Haiku', provider: 'Anthropic', logo: 'assets/claude-logo.png', logoScale: '2.592', inputTokens: 245210, outputTokens: 174560, totalCost: 4.56, requestCount: 423 }
        ],
        'performance': [
            { name: 'GPT-5', provider: 'OpenAI', logo: 'assets/chatgpt-logo.png', logoScale: '0.9', inputTokens: 100000, outputTokens: 60000, totalCost: 8.33, requestCount: 230 },
            { name: 'Gemini 2.5 Pro', provider: 'Google', logo: 'assets/gemini-logo.png', logoScale: '3.6', inputTokens: 78560, outputTokens: 52340, totalCost: 6.89, requestCount: 156 },
            { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', logo: 'assets/claude-logo.png', logoScale: '2.592', inputTokens: 100000, outputTokens: 70000, totalCost: 6.43, requestCount: 222 }
        ]
    };

    const trackingData = allTrackingData[selectedProfile] || allTrackingData['all'];

    const totalInput = trackingData.reduce((sum, model) => sum + model.inputTokens, 0);
    const totalOutput = trackingData.reduce((sum, model) => sum + model.outputTokens, 0);
    const totalCost = trackingData.reduce((sum, model) => sum + model.totalCost, 0);

    document.getElementById('totalInputTokens').textContent = totalInput.toLocaleString();
    document.getElementById('totalOutputTokens').textContent = totalOutput.toLocaleString();
    document.getElementById('totalCost').textContent = '$' + totalCost.toFixed(2);

    const grid = document.getElementById('trackingModelsGrid');
    if (!grid) return;

    grid.innerHTML = trackingData.map(model => {
        const totalTokens = model.inputTokens + model.outputTokens;
        const avgCostPerRequest = model.totalCost / model.requestCount;

        return `
            <div style="background: var(--bg-elevated); border-radius: 14px; border: 2px solid var(--border-subtle); padding: 16px; transition: all 0.2s;">
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 16px; height: 36px;">
                    <img src="${model.logo}" alt="${model.provider}" style="width: 108px; height: 36px; object-fit: contain; transform: scale(${model.logoScale});" draggable="false">
                </div>
                <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: var(--text-primary); text-align: center;">${model.name}</h3>
                <div style="text-align: center; margin-bottom: 16px;">
                    <span style="font-size: 11px; color: rgba(92, 49, 30, 0.6); font-weight: 500;">${model.requestCount} requests</span>
                </div>
                <div style="background: rgba(142, 60, 44, 0.04); border-radius: 10px; padding: 14px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 12px; color: rgba(92, 49, 30, 0.7); font-weight: 500;">Input Tokens</span>
                        <span style="font-size: 14px; color: #8e3c2c; font-weight: 700;">${model.inputTokens.toLocaleString()}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 12px; color: rgba(92, 49, 30, 0.7); font-weight: 500;">Output Tokens</span>
                        <span style="font-size: 14px; color: #c98454; font-weight: 700;">${model.outputTokens.toLocaleString()}</span>
                    </div>
                    <div style="height: 1px; background: rgba(142, 60, 44, 0.1); margin: 10px 0;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 12px; color: rgba(92, 49, 30, 0.7); font-weight: 500;">Total Tokens</span>
                        <span style="font-size: 14px; color: #5b2a1a; font-weight: 700;">${totalTokens.toLocaleString()}</span>
                    </div>
                </div>
                <div style="background: linear-gradient(135deg, rgba(142, 60, 44, 0.08) 0%, rgba(212, 165, 116, 0.08) 100%); border-radius: 10px; padding: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 13px; color: #5b2a1a; font-weight: 600;">Total Cost</span>
                        <span style="font-size: 18px; color: #8e3c2c; font-weight: 700;">$${model.totalCost.toFixed(2)}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 10px; color: rgba(92, 49, 30, 0.6);">avg. $${avgCostPerRequest.toFixed(4)}/req</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function init() {
    wireTabs();
    hydrateDashboard();
    initCostComparisonChart();
    populateMarketplace();
    populateTracking();
    testConnection();
    loadConversationsFromBackend();  // Load user's conversations from backend
    promptInput?.focus();

    // Add event listener for model sort dropdown
    const modelSortSelect = document.getElementById('modelSortSelect');
    if (modelSortSelect) {
        modelSortSelect.addEventListener('change', (e) => {
            populateMarketplace(e.target.value);
        });
    }

    // Add event listeners for tracking profile filters
    const trackingProfileButtons = document.querySelectorAll('.tracking-profile-filter');
    trackingProfileButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            trackingProfileButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            const selectedProfile = e.target.dataset.profile;
            populateTracking(selectedProfile);
        });
    });

    // Theme toggle button
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Model Override Modal
    const modelOverrideBtn = document.getElementById('modelOverrideBtn');
    const modelOverrideModal = document.getElementById('modelOverrideModal');
    const closeModelOverrideModal = document.getElementById('closeModelOverrideModal');
    const modelSearchInput = document.getElementById('modelSearchInput');

    if (modelOverrideBtn) {
        modelOverrideBtn.addEventListener('click', () => {
            if (modelOverrideModal) {
                modelOverrideModal.classList.add('active');
                populateModelOverrideList();
                if (modelSearchInput) {
                    modelSearchInput.value = '';
                    setTimeout(() => modelSearchInput.focus(), 100);
                }
            }
        });
    }

    if (closeModelOverrideModal) {
        closeModelOverrideModal.addEventListener('click', () => {
            if (modelOverrideModal) {
                modelOverrideModal.classList.remove('active');
            }
        });
    }

    if (modelOverrideModal) {
        modelOverrideModal.addEventListener('click', (e) => {
            if (e.target === modelOverrideModal) {
                modelOverrideModal.classList.remove('active');
            }
        });
    }

    if (modelSearchInput) {
        modelSearchInput.addEventListener('input', (e) => {
            populateModelOverrideList(e.target.value);
        });
    }

    const clearAllModels = document.getElementById('clearAllModels');
    if (clearAllModels) {
        clearAllModels.addEventListener('click', (e) => {
            e.stopPropagation();
            clearOverrideModel();
        });
    }
}

init();
