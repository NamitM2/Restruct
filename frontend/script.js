const API_URL = 'http://localhost:8000';
window.API_URL = API_URL;

// Session stats tracking
const sessionStats = {
    inputTokens: 0,
    outputTokens: 0,
    modelsUsed: new Set(),
    latencies: [],
    totalCost: 0
};

function updateSessionStats() {
    document.getElementById('statsInputTokens').textContent = sessionStats.inputTokens.toLocaleString();
    document.getElementById('statsOutputTokens').textContent = sessionStats.outputTokens.toLocaleString();

    // Display model names instead of count
    const modelsUsedEl = document.getElementById('statsModelsUsed');
    if (sessionStats.modelsUsed.size === 0) {
        modelsUsedEl.textContent = 'none';
    } else {
        const modelNames = Array.from(sessionStats.modelsUsed).join('\n');
        modelsUsedEl.textContent = modelNames;
    }

    const avgLatency = sessionStats.latencies.length > 0
        ? Math.round(sessionStats.latencies.reduce((a, b) => a + b, 0) / sessionStats.latencies.length)
        : 0;
    document.getElementById('statsAvgLatency').textContent = `${avgLatency}ms`;
    document.getElementById('statsTotalCost').textContent = `$${sessionStats.totalCost.toFixed(4)}`;
}

function resetSessionStats() {
    sessionStats.inputTokens = 0;
    sessionStats.outputTokens = 0;
    sessionStats.modelsUsed = new Set();
    sessionStats.latencies = [];
    sessionStats.totalCost = 0;
    updateSessionStats();
}

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
            conversation_id: currentConversation.conversationId,  // Include conversation ID
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

        const startTime = Date.now();

        try {
            // Create conversation first if this is a new chat
            if (!currentConversation.conversationId) {
                const convResponse = await fetch(`${API_URL}/conversations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: 'default-user',
                        title: 'New Chat'
                    })
                });

                if (!convResponse.ok) {
                    throw new Error('Failed to create conversation');
                }

                const convData = await convResponse.json();
                currentConversation.conversationId = convData.conversation.id;
                payload.conversation_id = currentConversation.conversationId;
            }

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
            const latency = Date.now() - startTime;

            // Update session stats
            sessionStats.inputTokens += data.usage?.input_tokens || prompt.split(' ').length * 1.3; // Rough estimate
            sessionStats.outputTokens += data.usage?.output_tokens || data.output.split(' ').length * 1.3;
            sessionStats.modelsUsed.add(data.model);
            sessionStats.latencies.push(latency);
            sessionStats.totalCost += data.usage?.cost || 0.001; // Default cost estimate
            updateSessionStats();

            removeLoading(loadingId);
            addMessage('assistant', data.output, {
                model: data.model,
                provider: data.provider,
                score: data.routing_metadata?.score,
                latency: latency,
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

function addMessage(role, content, metadata = null) {
    if (!chatContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;

    // Add model logo at the top for assistant messages
    if (role === 'assistant' && metadata && metadata.model) {
        const modelLogoMap = {
            'gpt-4': 'assets/chatgpt-logo.png',
            'gpt-3.5-turbo': 'assets/chatgpt-logo.png',
            'claude-3-opus': 'assets/claude-logo.png',
            'claude-3-sonnet': 'assets/claude-logo.png',
            'claude-3-haiku': 'assets/claude-logo.png',
            'qwen': 'assets/qwen-logo.png',
            'mistral': 'assets/mistral-logo.png',
            'perplexity': 'assets/perplexity-logo.png',
            'grok': 'assets/grok-logo.png',
            'deepseek': 'assets/deepseek-logo.png',
            'llama': 'assets/llama-logo.png',
            'gemini': 'assets/gemini-logo.png'
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
    textDiv.textContent = content;
    textDiv.className = 'message-text';
    contentDiv.appendChild(textDiv);

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

        if (metadata.latency) {
            const latencySpan = document.createElement('span');
            latencySpan.className = 'response-latency';
            latencySpan.textContent = `${metadata.latency}ms`;
            infoDiv.appendChild(latencySpan);
        }

        footerDiv.appendChild(infoDiv);
        contentDiv.appendChild(footerDiv);
    }

    messageDiv.appendChild(contentDiv);

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Store message in current conversation
    currentConversation.messages.push({
        role,
        text: content,
        metadata
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

// Conversations Management
let conversations = [];
let currentConversation = {
    id: Date.now(),
    conversationId: null,  // Backend conversation ID
    messages: [],
    timestamp: new Date()
};

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
            <div class="conversation-item" data-conversation-id="${conv.id}">
                <div class="conversation-item-header">
                    <span class="conversation-timestamp">${formatTimestamp(conv.timestamp)}</span>
                </div>
                <div class="conversation-summary">
                    ${conv.messages.length > 0 ? conv.messages[0].text : 'Empty conversation'}
                </div>
            </div>
        `).join('');

    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
            const convId = parseInt(item.dataset.conversationId);
            loadConversation(convId);
        });
    });
}

function loadConversation(conversationId) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    // Remove all messages but keep chat-controls
    const messages = chatContainer.querySelectorAll('.message');
    const welcomeMsg = chatContainer.querySelector('.welcome-message');

    messages.forEach(msg => msg.remove());
    if (welcomeMsg) welcomeMsg.remove();

    // Temporarily clear currentConversation messages to avoid duplication when addMessage is called
    const tempConversation = currentConversation;
    currentConversation = {
        id: conversation.id,
        conversationId: conversation.conversationId,  // Restore backend conversation ID
        messages: [],
        timestamp: conversation.timestamp
    };

    conversation.messages.forEach(msg => {
        addMessage(msg.role, msg.text, msg.metadata);
    });

    conversations = conversations.filter(c => c.id !== conversationId);

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
        timestamp: new Date()
    };

    // Reset session stats
    resetSessionStats();

    // Remove all messages but keep chat-controls
    const messages = chatContainer.querySelectorAll('.message');
    const welcomeMsg = chatContainer.querySelector('.welcome-message');

    messages.forEach(msg => msg.remove());
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
                <p style="margin: 0; color: rgba(92, 49, 30, 0.5); font-size: 14px;">No active keys yet</p>
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

// Conversation Stats Toggle
const statsToggleBtn = document.getElementById('statsToggleBtn');
const conversationStatsSidebar = document.getElementById('conversationStatsSidebar');

if (statsToggleBtn && conversationStatsSidebar) {
    statsToggleBtn.addEventListener('click', () => {
        conversationStatsSidebar.classList.toggle('collapsed');
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
