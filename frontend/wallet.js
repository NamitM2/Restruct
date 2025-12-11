/**
 * Wallet Management
 * Handles wallet balance display and fund management
 */

const API_BASE_URL = 'http://localhost:8000/v1';

// Fetch and display wallet balance
async function loadWalletBalance() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/wallet`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error('Failed to load wallet balance:', response.statusText);
            return;
        }

        const data = await response.json();
        updateWalletDisplay(data.balance);

        // Also load spending metrics
        await loadSpendingMetrics();

    } catch (error) {
        console.error('Error loading wallet balance:', error);
    }
}

// Load spending metrics from API usage
async function loadSpendingMetrics() {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/usage?limit=1000`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error('Failed to load usage data:', response.statusText);
            return;
        }

        const result = await response.json();
        const usageData = result.data || [];

        // Calculate spending for different time periods
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        let spend24h = 0;
        let spend7d = 0;
        let spend30d = 0;

        usageData.forEach(item => {
            const itemDate = new Date(item.created_at);
            const cost = parseFloat(item.estimated_cost) || 0;

            if (itemDate >= oneDayAgo) {
                spend24h += cost;
            }
            if (itemDate >= sevenDaysAgo) {
                spend7d += cost;
            }
            if (itemDate >= thirtyDaysAgo) {
                spend30d += cost;
            }
        });

        // Update UI
        const spend24hEl = document.getElementById('spend24h');
        const spend7dEl = document.getElementById('spend7d');
        const spend30dEl = document.getElementById('spend30d');

        if (spend24hEl) spend24hEl.textContent = `$${spend24h.toFixed(2)}`;
        if (spend7dEl) spend7dEl.textContent = `$${spend7d.toFixed(2)}`;
        if (spend30dEl) spend30dEl.textContent = `$${spend30d.toFixed(2)}`;

    } catch (error) {
        console.error('Error loading spending metrics:', error);
    }
}

// Update wallet balance display
function updateWalletDisplay(balance) {
    const billingWalletBalance = document.getElementById('billingWalletBalance');

    if (billingWalletBalance) {
        billingWalletBalance.textContent = `$${balance.toFixed(2)}`;
    }
}

// Add funds to wallet
async function addFunds(amount) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Please sign in to add funds');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/wallet/add-funds?amount=${amount}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to add funds');
        }

        const data = await response.json();
        updateWalletDisplay(data.balance);

        return data;

    } catch (error) {
        console.error('Error adding funds:', error);
        throw error;
    }
}

// Show add funds modal
function showAddFundsModal() {
    const amount = prompt('Enter amount to add (USD):\n\nNote: This is a test endpoint and does not process real payments.', '10.00');

    if (amount === null) return; // User cancelled

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    addFunds(parsedAmount).then(data => {
        alert(`Successfully added $${data.added.toFixed(2)} to your wallet.\nNew balance: $${data.balance.toFixed(2)}`);
    }).catch(error => {
        alert(`Error adding funds: ${error.message}`);
    });
}

// Initialize wallet functionality
document.addEventListener('DOMContentLoaded', () => {
    // Load wallet balance on page load
    loadWalletBalance();

    // Set up add funds button in billing tab
    const billingAddFundsBtn = document.getElementById('billingAddFundsBtn');
    if (billingAddFundsBtn) {
        billingAddFundsBtn.addEventListener('click', showAddFundsModal);
    }

    // Refresh wallet balance every 30 seconds
    setInterval(loadWalletBalance, 30000);
});

// Export functions for use in other scripts
window.walletAPI = {
    loadWalletBalance,
    updateWalletDisplay,
    addFunds,
    showAddFundsModal
};
