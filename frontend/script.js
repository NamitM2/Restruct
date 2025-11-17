const API_URL = 'http://localhost:8000';
window.API_URL = API_URL;

// Tab navigation
const tabButtons = document.querySelectorAll('.nav-icon-button');
const tabPanels = document.querySelectorAll('.tab-panel');
const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const promptInput = document.getElementById('promptInput');
const sendButton = document.getElementById('sendButton');
const modelPicker = document.getElementById('modelPicker');
const modelSelect = document.getElementById('modelSelect');

// Profile controls
const profilesGrid = document.getElementById('profilesGrid');
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

let currentProfileName = 'default';

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
    models: [
        { name: 'GPT-5', vendor: 'OpenAI', share: 42, spend: 4820, tokens: 12200000, latency: '610 ms' },
        { name: 'Gemini 2.5 Pro', vendor: 'Google', share: 27, spend: 2415, tokens: 8200000, latency: '520 ms' },
        { name: 'Claude Opus 4.1', vendor: 'Anthropic', share: 18, spend: 3200, tokens: 5600000, latency: '480 ms' },
        { name: 'Gemini 2.5 Flash', vendor: 'Google', share: 8, spend: 860, tokens: 3900000, latency: '340 ms' },
        { name: 'GPT-5 Mini Nano', vendor: 'OpenAI', share: 5, spend: 260, tokens: 2100000, latency: '220 ms' }
    ]
};

let isLoading = false;

function formatCurrency(value) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatNumber(value) {
    return value.toLocaleString();
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

    const modelStatsBody = document.getElementById('modelStatsBody');
    if (modelStatsBody) {
        modelStatsBody.innerHTML = dashboardData.models.map(model => `
            <tr>
                <td>${model.name}</td>
                <td>${model.vendor}</td>
                <td>${model.share}%</td>
                <td>${formatCurrency(model.spend)}</td>
                <td>${formatNumber(model.tokens)}</td>
                <td>${model.latency}</td>
            </tr>
        `).join('');
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
    'default': { latency: 'medium', cost: 'medium', quality: 'medium', description: 'Balanced' },
    'cost-optimized': { latency: 'low', cost: 'high', quality: 'low', description: 'Minimize costs' },
    'performance-first': { latency: 'high', cost: 'low', quality: 'high', description: 'Best quality responses' }
};

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

    const displayName = profileName.split('-').map(capitalizeFirst).join(' ');
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

function updateProfileBadges(card, profile) {
    const badges = card.querySelector('.profile-badges');
    if (!badges) return;
    badges.innerHTML = '';
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
        const displayName = activeCard ? activeCard.dataset.profileLabel : profileName;
        profileIndicator.textContent = displayName;
    }
}

// Profile card clicks
if (profilesGrid) {
    profilesGrid.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.profile-edit-btn, .profile-action-btn');
        if (editBtn) {
            e.stopPropagation();
            const card = editBtn.closest('.profile-card');
            if (card) {
                const profileName = card.dataset.profile;
                const profileData = profiles[profileName];
                setActiveProfile(profileName);
                if (profileData?.graph_state) {
                    window.profileBuilderOverlay?.open({
                        profile: {
                            name: profileData.name || card.dataset.profileLabel || profileName,
                            description: profileData.description,
                            graph_state: profileData.graph_state,
                            user_id: profileData.user_id
                        }
                    });
                } else {
                    openProfileModal(profileName);
                }
            }
            return;
        }

        const statsBtn = e.target.closest('.profile-stats-btn');
        if (statsBtn) {
            e.stopPropagation();
            const card = statsBtn.closest('.profile-card');
            if (card) {
                const profileName = card.dataset.profile;
                console.log('Stats for profile:', profileName);
            }
            return;
        }

        const deleteBtn = e.target.closest('.profile-delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const card = deleteBtn.closest('.profile-card');
            if (card) {
                const profileName = card.dataset.profile;

                if (confirm(`Are you sure you want to delete the "${card.dataset.profileLabel}" profile?`)) {
                    delete profiles[profileName];
                    card.remove();

                    if (currentProfileName === profileName) {
                        setActiveProfile('default');
                    }
                }
            }
            return;
        }

        const card = e.target.closest('.profile-card');
        if (!card) return;

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
    if (!graphState?.priorities) return levels;

    const toLevel = (weight) => {
        if (weight >= 0.67) return 'high';
        if (weight <= 0.33) return 'low';
        return 'medium';
    };

    graphState.priorities.forEach(priority => {
        if (priority.id === 'latency') levels.latency = toLevel(priority.weight);
        if (priority.id === 'cost') levels.cost = toLevel(priority.weight);
        if (priority.id === 'quality') levels.quality = toLevel(priority.weight);
    });
    return levels;
}

function buildProfileCard(slug, displayName, profileData) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.dataset.profile = slug;
    card.dataset.profileLabel = displayName;
    card.style.cssText = 'width: 260px; background: #fff; border-radius: 18px; border: 2px solid rgba(92, 49, 30, 0.12); padding: 18px;';

    const isDefault = ['default', 'cost-optimized', 'performance-first'].includes(slug);
    const deleteButtonHtml = !isDefault ? `
        <button class="profile-delete-btn" title="Delete profile" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 10px; border: 1px solid rgba(220, 38, 38, 0.2); border-radius: 8px; background: white; color: #dc2626; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            Delete
        </button>
    ` : '';

    card.innerHTML = `
        <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #2b1d14;">${displayName}</h4>
        <div style="display: flex; gap: 8px;">
            <button class="profile-action-btn" title="Edit profile" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 10px; border: 1px solid rgba(92, 49, 30, 0.2); border-radius: 8px; background: white; color: #5b2a1a; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit
            </button>
            <button class="profile-stats-btn" title="View statistics" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 10px; border: 1px solid rgba(92, 49, 30, 0.2); border-radius: 8px; background: white; color: #5b2a1a; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
                <img src="assets/stats-icon.png" alt="Stats" style="width: 12px; height: 12px; opacity: 0.7;">
                Stats
            </button>
            ${deleteButtonHtml}
        </div>
    `;
    return card;
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

window.addEventListener('routing-profile:created', (event) => {
    const profile = event.detail?.profile;
    if (!profile || !profilesGrid) return;

    const slug = profile.slug || slugifyProfileName(profile.name || 'custom-profile');
    const displayName = profile.name || 'Custom Profile';
    const priorityLevels = derivePriorityLevels(profile.graph_state);

    profiles[slug] = {
        ...priorityLevels,
        description: profile.description || 'Custom profile',
        graph_state: profile.graph_state,
        supabase_id: profile.id,
        user_id: profile.user_id,
        name: displayName
    };

    const existing = document.querySelector(`[data-profile="${slug}"]`);
    if (existing) {
        existing.remove();
    }

    const card = buildProfileCard(slug, displayName, profiles[slug]);
    profilesGrid.appendChild(card);
    setActiveProfile(slug);
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

        delete profiles[currentProfileName];
        const card = document.querySelector(`[data-profile="${currentProfileName}"]`);
        if (card) {
            card.remove();
        }

        closeProfileModal();
        setActiveProfile('default');
    });
}

if (promptInput) {
    promptInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });

    promptInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            chatForm?.dispatchEvent(new Event('submit'));
        }
    });
}

if (chatForm) {
    chatForm.addEventListener('submit', async event => {
        event.preventDefault();
        const prompt = promptInput?.value.trim();
        if (!prompt || isLoading) return;

        const currentProfile = profiles[currentProfileName] || profiles['default'];
        const payload = {
            prompt,
            profile: currentProfileName,
            priorities: {
                latency: currentProfile.latency,
                cost: currentProfile.cost,
                quality: currentProfile.quality
            },
            max_tokens: 1000,
            temperature: 0.7,
            router_mode: 'auto',
            model_override: null
        };

        if (promptInput) {
            promptInput.value = '';
            promptInput.style.height = 'auto';
        }
        setLoading(true);

        const welcomeMsg = chatContainer?.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
            // Enter focus mode on first message
            document.body.classList.add('focus-mode');
        }

        addMessage('user', prompt);
        const loadingId = showLoading();

        try {
            const response = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'API request failed');
            }

            const data = await response.json();
            removeLoading(loadingId);
            addMessage('assistant', data.output, {
                model: data.model,
                provider: data.provider,
                score: data.routing_metadata?.score
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

function addMessage(role, content, metadata = null) {
    if (!chatContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (role === 'assistant' && metadata && metadata.model !== 'error') {
        const routingInfo = document.createElement('div');
        routingInfo.className = 'routing-info';
        routingInfo.innerHTML = `Routed to <strong>${metadata.model}</strong>`;
        contentDiv.appendChild(routingInfo);
    }

    const textDiv = document.createElement('div');
    textDiv.textContent = content;
    contentDiv.appendChild(textDiv);

    if (role === 'assistant' && metadata) {
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'message-metadata';

        if (metadata.model) {
            const modelBadge = document.createElement('span');
            modelBadge.className = 'model-badge';
            modelBadge.textContent = metadata.model;
            metadataDiv.appendChild(modelBadge);
        }

        if (metadata.provider) {
            const providerSpan = document.createElement('span');
            providerSpan.textContent = `Provider: ${metadata.provider}`;
            metadataDiv.appendChild(providerSpan);
        }

        if (metadata.score) {
            const scoreSpan = document.createElement('span');
            scoreSpan.textContent = `Score: ${metadata.score.toFixed(2)}`;
            metadataDiv.appendChild(scoreSpan);
        }

        contentDiv.appendChild(metadataDiv);
    }

    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
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
        <div class="loading-dots">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
        </div>
        <span>Thinking...</span>
    `;

    messageDiv.appendChild(loadingDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return loadingId;
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
                        label: function(context) {
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
                        callback: function(value) {
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

function toggleModelStats(event) {
    toggleCollapsible(event, 'modelStatsContent', '.model-stats .collapse-toggle');
}

// Focus Mode
const enterFocusBtn = document.getElementById('enterFocusBtn');
const exitFocusBtn = document.getElementById('exitFocusBtn');

if (enterFocusBtn) {
    enterFocusBtn.addEventListener('click', () => {
        document.body.classList.add('focus-mode');
    });
}

if (exitFocusBtn) {
    exitFocusBtn.addEventListener('click', () => {
        document.body.classList.remove('focus-mode');
    });
}

function init() {
    wireTabs();
    hydrateDashboard();
    initCostComparisonChart();
    testConnection();
    promptInput?.focus();
}

init();
