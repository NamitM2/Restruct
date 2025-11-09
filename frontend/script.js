// Configuration
const API_URL = 'http://localhost:8000';

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const promptInput = document.getElementById('promptInput');
const sendButton = document.getElementById('sendButton');
const prioritySelect = document.getElementById('priority');

// State
let isLoading = false;

// Auto-resize textarea
promptInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});

// Handle Enter key (Shift+Enter for new line)
promptInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const prompt = promptInput.value.trim();
    if (!prompt || isLoading) return;

    const priority = prioritySelect.value;

    // Clear input and disable
    promptInput.value = '';
    promptInput.style.height = 'auto';
    setLoading(true);

    // Remove welcome message if it exists
    const welcomeMsg = chatContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    // Add user message
    addMessage('user', prompt);

    // Show loading indicator
    const loadingId = showLoading();

    try {
        // Call API
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                priority: priority,
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'API request failed');
        }

        const data = await response.json();

        // Remove loading indicator
        removeLoading(loadingId);

        // Add assistant message
        addMessage('assistant', data.output, {
            model: data.model,
            provider: data.provider,
            score: data.routing_metadata.score
        });

    } catch (error) {
        console.error('Error:', error);
        removeLoading(loadingId);
        addMessage('assistant', `Error: ${error.message}. Make sure the backend is running and API keys are configured.`, {
            model: 'error',
            provider: 'system'
        });
    } finally {
        setLoading(false);
        promptInput.focus();
    }
});

// Add message to chat
function addMessage(role, content, metadata = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const textDiv = document.createElement('div');
    textDiv.textContent = content;
    contentDiv.appendChild(textDiv);

    // Add routing info at the top for assistant messages
    if (role === 'assistant' && metadata && metadata.model !== 'error') {
        const routingInfo = document.createElement('div');
        routingInfo.className = 'routing-info';
        routingInfo.innerHTML = `📍 Routed to: <strong>${metadata.model}</strong>`;
        contentDiv.insertBefore(routingInfo, textDiv);
    }

    // Add metadata for assistant messages
    if (role === 'assistant' && metadata) {
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'message-metadata';

        const modelBadge = document.createElement('span');
        modelBadge.className = 'model-badge';
        modelBadge.innerHTML = `🤖 ${metadata.model}`;
        metadataDiv.appendChild(modelBadge);

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

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show loading indicator
function showLoading() {
    const loadingId = `loading-${Date.now()}`;
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

// Remove loading indicator
function removeLoading(loadingId) {
    const loadingElement = document.getElementById(loadingId);
    if (loadingElement) {
        loadingElement.remove();
    }
}

// Set loading state
function setLoading(loading) {
    isLoading = loading;
    sendButton.disabled = loading;
    promptInput.disabled = loading;

    if (loading) {
        sendButton.querySelector('.button-text').textContent = 'Sending...';
    } else {
        sendButton.querySelector('.button-text').textContent = 'Send';
    }
}

// Test API connection on load
async function testConnection() {
    try {
        const response = await fetch(`${API_URL}/`);
        if (response.ok) {
            console.log('✅ Backend connected successfully');
        }
    } catch (error) {
        console.warn('⚠️ Backend not connected. Make sure to run: uvicorn app:app --reload');
    }
}

// Initialize
testConnection();
promptInput.focus();
