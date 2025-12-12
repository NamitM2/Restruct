/**
 * Real-time Statistics and Analytics for Restruct
 * Loads live data from api_usage table
 */

const STATS_API_BASE = 'http://localhost:8000/v1';
let dashboardChart = null;
let modelUsageChart = null;

// Load real dashboard metrics
async function loadRealDashboardMetrics() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.log('No token, skipping dashboard metrics load');
        return;
    }

    try {
        const response = await fetch(`${STATS_API_BASE}/statistics/dashboard`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        const metrics = result.data;

        // Update spending metrics
        const spendIds = {
            daily: document.getElementById('spendDaily'),
            weekly: document.getElementById('spendWeekly'),
            monthly: document.getElementById('spendMonthly'),
            yearly: document.getElementById('spendYearly'),
            last24: document.getElementById('spendLast24')
        };

        if (spendIds.daily) {
            spendIds.daily.textContent = `$${metrics.spending.daily.toFixed(2)}`;
            spendIds.weekly.textContent = `$${metrics.spending.weekly.toFixed(2)}`;
            spendIds.monthly.textContent = `$${metrics.spending.monthly.toFixed(2)}`;
            spendIds.yearly.textContent = `$${metrics.spending.yearly.toFixed(2)}`;
            spendIds.last24.textContent = `$${metrics.spending.last24.toFixed(2)}`;
        }

        // Update token metrics
        const tokenIds = {
            daily: document.getElementById('tokensDaily'),
            weekly: document.getElementById('tokensWeekly'),
            monthly: document.getElementById('tokensMonthly'),
            yearly: document.getElementById('tokensYearly')
        };

        if (tokenIds.daily) {
            tokenIds.daily.textContent = metrics.tokens.daily.toLocaleString();
            tokenIds.weekly.textContent = metrics.tokens.weekly.toLocaleString();
            tokenIds.monthly.textContent = metrics.tokens.monthly.toLocaleString();
            tokenIds.yearly.textContent = metrics.tokens.yearly.toLocaleString();
        }

        console.log('Dashboard metrics loaded successfully');

    } catch (error) {
        console.error('Error loading dashboard metrics:', error);
    }
}

// Load usage timeline and create chart
async function loadUsageTimeline() {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        const response = await fetch(`${STATS_API_BASE}/statistics/timeline?days=30`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        const timeline = result.data;

        if (timeline.length === 0) {
            console.log('No usage data yet for timeline chart');
            return;
        }

        // Create timeline chart
        createTimelineChart(timeline);

    } catch (error) {
        console.error('Error loading usage timeline:', error);
    }
}

// Create timeline chart
function createTimelineChart(timeline) {
    const ctx = document.getElementById('usageTimelineChart');
    if (!ctx) {
        console.log('Timeline chart canvas not found');
        return;
    }

    const labels = timeline.map(day => {
        const date = new Date(day.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const costs = timeline.map(day => day.cost);
    const tokens = timeline.map(day => day.tokens);

    // Destroy existing chart if it exists
    if (dashboardChart) {
        dashboardChart.destroy();
    }

    dashboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Daily Cost ($)',
                    data: costs,
                    borderColor: '#D4356F',
                    backgroundColor: 'rgba(212, 53, 111, 0.15)',
                    borderWidth: 2,
                    fill: true,
                    yAxisID: 'y',
                    tension: 0.3
                },
                {
                    label: 'Daily Tokens',
                    data: tokens,
                    borderColor: '#1AA8CC',
                    backgroundColor: 'rgba(26, 168, 204, 0.15)',
                    borderWidth: 2,
                    fill: true,
                    yAxisID: 'y1',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Usage Over Time (30 Days)',
                    font: { size: 16, weight: '600' }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Cost ($)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Tokens'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Load model breakdown for tracking tab
async function loadRealModelBreakdown(selectedProfile = 'all') {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        const url = selectedProfile && selectedProfile !== 'all'
            ? `${STATS_API_BASE}/statistics/models?profile=${encodeURIComponent(selectedProfile)}`
            : `${STATS_API_BASE}/statistics/models`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        const breakdown = result.data;

        // Update summary cards
        const totalInputTokens = breakdown.reduce((sum, model) => sum + model.input_tokens, 0);
        const totalOutputTokens = breakdown.reduce((sum, model) => sum + model.output_tokens, 0);
        const totalCost = breakdown.reduce((sum, model) => sum + model.total_cost, 0);

        const totalInputEl = document.getElementById('totalInputTokens');
        const totalOutputEl = document.getElementById('totalOutputTokens');
        const totalCostEl = document.getElementById('totalCost');

        if (totalInputEl) totalInputEl.textContent = totalInputTokens.toLocaleString();
        if (totalOutputEl) totalOutputEl.textContent = totalOutputTokens.toLocaleString();
        if (totalCostEl) totalCostEl.textContent = `$${totalCost.toFixed(2)}`;

        // Populate tracking table
        populateTrackingTable(breakdown);

        // Create model usage chart
        createModelUsageChart(breakdown);

        console.log('Model breakdown loaded successfully:', breakdown.length, 'models');

    } catch (error) {
        console.error('Error loading model breakdown:', error);
    }
}

// Populate tracking table with real data
function populateTrackingTable(breakdown) {
    const container = document.getElementById('trackingModelsGrid');
    if (!container) return;

    if (breakdown.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(43, 29, 20, 0.5);">No usage data yet. Start making requests to see stats!</div>';
        return;
    }

    // Map provider names to logo paths
    const providerLogos = {
        'openai': { logo: 'assets/chatgpt-logo.png', scale: '1.0' },
        'anthropic': { logo: 'assets/claude-logo.png', scale: '2.88' },
        'google': { logo: 'assets/gemini-logo.png', scale: '4.0' }
    };

    container.innerHTML = breakdown.map(model => {
        const logoInfo = providerLogos[model.provider.toLowerCase()] || { logo: 'assets/default-logo.png', scale: '1.0' };
        const totalTokens = model.input_tokens + model.output_tokens;

        return `
            <div class="tracking-model-card">
                <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle);">
                    <div style="width: 48px; height: 48px; min-width: 48px; display: flex; align-items: center; justify-content: center;">
                        <img src="${logoInfo.logo}" alt="${model.provider}" style="width: 48px; height: 48px; object-fit: contain; transform: scale(${logoInfo.scale});">
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">${model.model}</div>
                        <div style="font-size: 12px; color: var(--text-muted); text-transform: capitalize;">${model.provider}</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px;">
                        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Input Tokens</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${model.input_tokens.toLocaleString()}</div>
                    </div>
                    <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px;">
                        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Output Tokens</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${model.output_tokens.toLocaleString()}</div>
                    </div>
                    <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px;">
                        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Total Cost</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--accent-primary);">$${model.total_cost.toFixed(4)}</div>
                    </div>
                    <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px;">
                        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Requests</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${model.request_count}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Create model usage pie chart (grouped by provider family)
function createModelUsageChart(breakdown) {
    const ctx = document.getElementById('modelUsageChart');
    if (!ctx) return;

    if (breakdown.length === 0) {
        console.log('No model data for chart');
        return;
    }

    // Destroy existing chart
    if (modelUsageChart) {
        modelUsageChart.destroy();
    }

    // Group by provider family
    const familyData = {};
    const familyModels = {}; // Store models per family for tooltip

    breakdown.forEach(model => {
        const family = model.provider.charAt(0).toUpperCase() + model.provider.slice(1);
        if (!familyData[family]) {
            familyData[family] = 0;
            familyModels[family] = [];
        }
        familyData[family] += model.total_cost;
        familyModels[family].push({
            model: model.model,
            cost: model.total_cost
        });
    });

    const labels = Object.keys(familyData);
    const costs = Object.values(familyData);

    // Provider family colors
    const familyColors = {
        'Openai': '#1AA8CC',
        'Anthropic': '#D4356F',
        'Google': '#E6A930'
    };
    const colors = labels.map(label => familyColors[label] || '#7C4D3A');

    modelUsageChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cost by Provider',
                data: costs,
                backgroundColor: colors,
                borderWidth: 3,
                borderColor: '#fff',
                hoverBorderWidth: 4,
                hoverBorderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: { size: 13, weight: '500' },
                        color: '#2b1d14',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return context[0].label + ' Models';
                        },
                        label: function(context) {
                            const family = context.label;
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `Total: $${value.toFixed(2)} (${percentage}%)`;
                        },
                        afterLabel: function(context) {
                            const family = context.label;
                            const models = familyModels[family] || [];
                            const lines = models.map(m => `  ${m.model}: $${m.cost.toFixed(2)}`);
                            return '\n' + lines.join('\n');
                        }
                    },
                    backgroundColor: 'rgba(43, 29, 20, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false
                }
            }
        }
    });
}

// Load profile breakdown
async function loadProfileBreakdown() {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        const response = await fetch(`${STATS_API_BASE}/statistics/profiles`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        const profiles = result.data;

        // Update profile filter buttons with real profile names
        updateProfileFilterButtons(profiles);

        console.log('Profile breakdown loaded:', profiles);

    } catch (error) {
        console.error('Error loading profile breakdown:', error);
    }
}

// Update profile filter buttons
function updateProfileFilterButtons(profiles) {
    const container = document.getElementById('trackingProfileSelector');
    if (!container) return;

    // Keep "All Activity" button
    const allButton = '<button class="btn-filter active tracking-profile-filter" data-profile="all">All Activity</button>';

    // Add buttons for each profile
    const profileButtons = profiles.map(profile =>
        `<button class="btn-filter tracking-profile-filter" data-profile="${profile.profile_name}">
            ${profile.profile_name} <span style="opacity: 0.7;">($${profile.total_cost.toFixed(2)})</span>
        </button>`
    ).join('');

    container.innerHTML = allButton + profileButtons;

    // Re-attach event listeners
    attachProfileFilterListeners();
}

// Attach event listeners to profile filter buttons
function attachProfileFilterListeners() {
    document.querySelectorAll('.tracking-profile-filter').forEach(button => {
        button.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.tracking-profile-filter').forEach(b => b.classList.remove('active'));
            button.classList.add('active');

            // Load data for selected profile
            const profile = button.dataset.profile;
            loadRealModelBreakdown(profile);
        });
    });
}

// Auto-refresh every 30 seconds
function startAutoRefresh() {
    setInterval(() => {
        loadRealDashboardMetrics();

        // Refresh tracking tab if visible
        const trackingTab = document.getElementById('trackingTab');
        if (trackingTab && !trackingTab.classList.contains('hidden')) {
            const activeFilter = document.querySelector('.tracking-profile-filter.active');
            const selectedProfile = activeFilter ? activeFilter.dataset.profile : 'all';
            loadRealModelBreakdown(selectedProfile);
        }
    }, 30000); // 30 seconds
}

// Initialize statistics on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Statistics module loaded');

    // Load dashboard metrics immediately
    loadRealDashboardMetrics();
    loadUsageTimeline();

    // Load tracking data
    loadRealModelBreakdown('all');
    loadProfileBreakdown();

    // Attach profile filter listeners
    attachProfileFilterListeners();

    // Start auto-refresh
    startAutoRefresh();

    // Listen for tab changes to refresh data
    document.querySelectorAll('[data-tab-target="dashboardTab"], [data-tab-target="trackingTab"]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.tabTarget;
            if (target === 'dashboardTab') {
                loadRealDashboardMetrics();
                loadUsageTimeline();
            } else if (target === 'trackingTab') {
                const activeFilter = document.querySelector('.tracking-profile-filter.active');
                const selectedProfile = activeFilter ? activeFilter.dataset.profile : 'all';
                loadRealModelBreakdown(selectedProfile);
                loadProfileBreakdown();
            }
        });
    });
});

// Export functions for global access
window.statisticsAPI = {
    loadRealDashboardMetrics,
    loadUsageTimeline,
    loadRealModelBreakdown,
    loadProfileBreakdown
};
