// =============================================================================
// REAL-TIME COLLABORATION & SHARING
// =============================================================================

const SUPABASE_URL = 'https://spazghkvabgcjanurdyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYXpnaGt2YWJnY2phbnVyZHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0MTE4NDksImV4cCI6MjA1MDk4Nzg0OX0.qhzHvGLfT4RoiEhBh1PJsB2rSNbFqMZPMCvMTa5mHWs';

let supabaseClient = null;
let realtimeSubscriptions = new Map();
let currentConversationId = null;
let presenceHeartbeat = null;

// Initialize Supabase client
function initializeSupabase() {
    if (!window.supabase) {
        console.error('Supabase library not loaded');
        return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });

    console.log('Supabase client initialized for realtime');
}

// =============================================================================
// SHARING FUNCTIONS
// =============================================================================

async function shareConversation(conversationId, permission = 'view', billing = 'owner', participantAccessDuration = 'forever', customHours = null) {
    const body = { permission, billing, participant_access_duration: participantAccessDuration };

    if (participantAccessDuration === 'custom' && customHours) {
        body.participant_access_custom_hours = parseInt(customHours);
    }

    const response = await fetch(`${API_URL}/v1/conversations/${conversationId}/share`, {
        method: 'POST',
        headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error('Failed to share conversation');
    }

    const result = await response.json();
    return result.data;
}

async function unshareConversation(conversationId) {
    const response = await fetch(`${API_URL}/v1/conversations/${conversationId}/share`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to unshare conversation');
    }

    return true;
}

async function joinConversation(shareToken) {
    const response = await fetch(`${API_URL}/v1/conversations/join/${shareToken}`, {
        method: 'POST',
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        throw new Error('Invalid or expired share link');
    }

    const result = await response.json();
    return result.data;
}

async function leaveConversation(conversationId) {
    const response = await fetch(`${API_URL}/v1/conversations/${conversationId}/leave`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to leave conversation');
    }

    return true;
}

async function getParticipants(conversationId) {
    const response = await fetch(`${API_URL}/v1/conversations/${conversationId}/participants`, {
        method: 'GET',
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to get participants');
    }

    const result = await response.json();
    return result.data;
}

// =============================================================================
// REALTIME SUBSCRIPTIONS
// =============================================================================

function subscribeToConversation(conversationId) {
    if (!supabaseClient) {
        initializeSupabase();
    }

    unsubscribeFromConversation(conversationId);

    const channel = supabaseClient
        .channel(`conversation:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            },
            (payload) => {
                handleNewMessage(payload.new);
            }
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'conversation_presence',
                filter: `conversation_id=eq.${conversationId}`
            },
            (payload) => {
                handlePresenceUpdate(payload);
            }
        )
        .subscribe();

    realtimeSubscriptions.set(conversationId, channel);
    currentConversationId = conversationId;

    startPresenceHeartbeat(conversationId);
}

function unsubscribeFromConversation(conversationId) {
    const channel = realtimeSubscriptions.get(conversationId);
    if (channel) {
        supabaseClient.removeChannel(channel);
        realtimeSubscriptions.delete(conversationId);
    }

    if (currentConversationId === conversationId) {
        stopPresenceHeartbeat();
        currentConversationId = null;
    }
}

function unsubscribeAll() {
    realtimeSubscriptions.forEach((channel, convId) => {
        supabaseClient.removeChannel(channel);
    });
    realtimeSubscriptions.clear();
    stopPresenceHeartbeat();
    currentConversationId = null;
}

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

function handleNewMessage(message) {
    const userId = getUserId();

    if (message.user_id === userId) {
        return;
    }

    const messageContainer = document.getElementById('messages-container');
    if (!messageContainer) return;

    if (message.role === 'user') {
        appendUserMessage(message.content, message.user_id);
    } else if (message.role === 'assistant') {
        appendAIMessage(message.content, message.provider, message.model);
    }

    messageContainer.scrollTop = messageContainer.scrollHeight;
}

function appendUserMessage(content, userId) {
    const messageContainer = document.getElementById('messages-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';

    const isCurrentUser = userId === getUserId();
    const labelText = isCurrentUser ? 'You' : 'Collaborator';

    messageDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <strong style="color: var(--accent-primary);">${labelText}</strong>
            ${!isCurrentUser ? '<span style="font-size: 12px; color: var(--text-secondary);">(shared)</span>' : ''}
        </div>
        <div>${escapeHtml(content)}</div>
    `;

    messageContainer.appendChild(messageDiv);
}

function appendAIMessage(content, provider, model) {
    const messageContainer = document.getElementById('messages-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';

    messageDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <strong>AI</strong>
            <span style="font-size: 12px; color: var(--text-secondary);">${provider}:${model}</span>
        </div>
        <div class="markdown-content">${content}</div>
    `;

    messageContainer.appendChild(messageDiv);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =============================================================================
// PRESENCE & TYPING INDICATORS
// =============================================================================

async function updatePresence(conversationId, isTyping = false) {
    const response = await fetch(`${API_URL}/v1/conversations/${conversationId}/presence`, {
        method: 'POST',
        headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_typing: isTyping })
    });

    return response.ok;
}

function startPresenceHeartbeat(conversationId) {
    stopPresenceHeartbeat();

    updatePresence(conversationId, false);

    presenceHeartbeat = setInterval(() => {
        updatePresence(conversationId, false);
    }, 15000);
}

function stopPresenceHeartbeat() {
    if (presenceHeartbeat) {
        clearInterval(presenceHeartbeat);
        presenceHeartbeat = null;
    }
}

async function getActiveUsers(conversationId) {
    const response = await fetch(`${API_URL}/v1/conversations/${conversationId}/presence`, {
        method: 'GET',
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        return [];
    }

    const result = await response.json();
    return result.data;
}

function handlePresenceUpdate(payload) {
    if (payload.eventType === 'DELETE') {
        removeTypingIndicator(payload.old.user_id);
    } else {
        const presence = payload.new;
        if (presence.is_typing && presence.user_id !== getUserId()) {
            showTypingIndicator(presence.user_id);
        } else {
            removeTypingIndicator(presence.user_id);
        }
    }
}

function showTypingIndicator(userId) {
    const container = document.getElementById('typing-indicators');
    if (!container) return;

    const existingIndicator = document.getElementById(`typing-${userId}`);
    if (existingIndicator) return;

    const indicator = document.createElement('div');
    indicator.id = `typing-${userId}`;
    indicator.className = 'typing-indicator';
    indicator.style.cssText = 'padding: 8px; color: var(--text-secondary); font-size: 14px; font-style: italic;';
    indicator.textContent = 'Collaborator is typing...';

    container.appendChild(indicator);
}

function removeTypingIndicator(userId) {
    const indicator = document.getElementById(`typing-${userId}`);
    if (indicator) {
        indicator.remove();
    }
}

// =============================================================================
// UI FUNCTIONS
// =============================================================================

function showShareModal(conversationId) {
    const needsName = !conversationId;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.2s ease, background 0.2s ease;
    `;

    modal.innerHTML = `
        <div id="share-modal-content" style="
            background: var(--bg-elevated);
            padding: 24px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            transform: scale(0.9) translateY(-20px);
            opacity: 0;
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        ">
            <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Share Conversation</h3>

            ${needsName ? `
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px;">
                    Conversation Name
                </label>
                <input type="text" id="conversation-name-input" placeholder="Enter a name for this conversation" style="
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                ">
                <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                    You need to save this conversation before sharing
                </p>
            </div>
            ` : ''}

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px;">
                    Permission Level
                </label>
                <select id="share-permission" style="
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                ">
                    <option value="view">View Only</option>
                    <option value="chat" selected>Can Chat</option>
                </select>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px;">
                    Billing
                </label>
                <select id="share-billing" style="
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                ">
                    <option value="owner" selected>Owner pays for all messages</option>
                    <option value="individual">Each user pays for their own messages</option>
                </select>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                    Choose who pays for API costs in this shared conversation
                </p>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px;">
                    Participant Chat Duration
                </label>
                <select id="share-access-duration" style="
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                ">
                    <option value="1h">1 Hour</option>
                    <option value="24h">24 Hours (1 Day)</option>
                    <option value="7d" selected>7 Days (1 Week)</option>
                    <option value="forever">Forever ⚠️</option>
                    <option value="custom">Custom ⚠️</option>
                </select>
                <p id="access-duration-help" style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                    How long participants can send messages after joining
                </p>
                <div id="custom-hours-input" style="display: none; margin-top: 8px;">
                    <input type="number" id="custom-hours" placeholder="Hours (1-8760)" min="1" max="8760" style="
                        width: 100%;
                        padding: 8px;
                        border: 1px solid var(--border-subtle);
                        border-radius: 6px;
                        background: var(--bg-primary);
                        color: var(--text-primary);
                    ">
                </div>
            </div>

            <div id="share-link-container" style="display: none; margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px;">
                    Share Link
                </label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="share-link-input" readonly style="
                        flex: 1;
                        padding: 8px;
                        border: 1px solid var(--border-subtle);
                        border-radius: 6px;
                        background: var(--bg-primary);
                        color: var(--text-primary);
                    ">
                    <button id="copy-link-btn" style="
                        padding: 8px 16px;
                        background: var(--accent-primary);
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                    ">Copy</button>
                </div>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="cancel-share-btn" style="
                    padding: 8px 16px;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    cursor: pointer;
                ">Cancel</button>
                <button id="generate-link-btn" style="
                    padding: 8px 16px;
                    background: var(--accent-primary);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                ">Generate Link</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    setTimeout(() => {
        modal.style.opacity = '1';
        modal.style.background = 'rgba(0, 0, 0, 0.5)';
        const content = document.getElementById('share-modal-content');
        if (content) {
            content.style.transform = 'scale(1) translateY(0)';
            content.style.opacity = '1';
        }
    }, 10);

    const closeModal = () => {
        modal.style.opacity = '0';
        modal.style.background = 'rgba(0, 0, 0, 0)';
        const content = document.getElementById('share-modal-content');
        if (content) {
            content.style.transform = 'scale(0.9) translateY(-20px)';
            content.style.opacity = '0';
        }
        setTimeout(() => modal.remove(), 300);
    };

    // Handle access duration dropdown changes
    const accessDurationSelect = document.getElementById('share-access-duration');
    const customHoursInput = document.getElementById('custom-hours-input');
    const accessDurationHelp = document.getElementById('access-duration-help');

    accessDurationSelect.onchange = () => {
        const value = accessDurationSelect.value;

        if (value === 'custom') {
            customHoursInput.style.display = 'block';
            accessDurationHelp.textContent = '⚠️ Warning: Custom durations should be used carefully. Consider using preset options for safety.';
            accessDurationHelp.style.color = '#ff9800';
        } else if (value === 'forever') {
            customHoursInput.style.display = 'none';
            accessDurationHelp.textContent = '⚠️ Warning: Participants will be able to send messages indefinitely. This may lead to unexpected costs if the conversation is shared publicly.';
            accessDurationHelp.style.color = '#ff9800';
        } else {
            customHoursInput.style.display = 'none';
            accessDurationHelp.textContent = 'How long participants can send messages after joining';
            accessDurationHelp.style.color = 'var(--text-secondary)';
        }
    };

    document.getElementById('cancel-share-btn').onclick = closeModal;

    document.getElementById('generate-link-btn').onclick = async () => {
        const permission = document.getElementById('share-permission').value;
        const billing = document.getElementById('share-billing').value;
        const btn = document.getElementById('generate-link-btn');
        btn.disabled = true;
        btn.textContent = 'Generating...';

        let actualConversationId = conversationId;

        if (needsName) {
            const nameInput = document.getElementById('conversation-name-input');
            const conversationName = nameInput.value.trim();

            if (!conversationName) {
                alert('Please enter a name for the conversation');
                btn.disabled = false;
                btn.textContent = 'Generate Link';
                return;
            }

            if (typeof saveCurrentConversation === 'function') {
                btn.textContent = 'Saving conversation...';
                const saved = await saveCurrentConversation(conversationName);
                if (!saved || !window.currentConversation?.conversationId) {
                    alert('Failed to save conversation');
                    btn.disabled = false;
                    btn.textContent = 'Generate Link';
                    return;
                }
                actualConversationId = window.currentConversation.conversationId;
            } else {
                alert('Cannot save conversation - please send at least one message first');
                btn.disabled = false;
                btn.textContent = 'Generate Link';
                return;
            }
        }

        // Get access duration settings
        const accessDuration = accessDurationSelect.value;
        let customHours = null;

        if (accessDuration === 'custom') {
            customHours = document.getElementById('custom-hours').value;
            if (!customHours || parseInt(customHours) < 1 || parseInt(customHours) > 8760) {
                alert('Please enter a valid number of hours (1-8760)');
                btn.disabled = false;
                btn.textContent = 'Generate Link';
                return;
            }
        }

        btn.textContent = 'Generating link...';
        const shareData = await shareConversation(actualConversationId, permission, billing, accessDuration, customHours);
        const shareUrl = `${window.location.origin}?share=${shareData.share_token}`;

        document.getElementById('share-link-input').value = shareUrl;
        document.getElementById('share-link-container').style.display = 'block';
        btn.textContent = 'Generated!';
    };

    document.getElementById('copy-link-btn').onclick = () => {
        const input = document.getElementById('share-link-input');
        input.select();
        document.execCommand('copy');

        const btn = document.getElementById('copy-link-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    };

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

async function handleShareTokenInUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareToken = urlParams.get('share');

    if (!shareToken) return;

    if (!isAuthenticated()) {
        alert('Please sign in to view shared conversation');
        return;
    }

    const conversation = await joinConversation(shareToken);

    window.history.replaceState({}, document.title, window.location.pathname);

    alert('Joined shared conversation!');
    loadConversationsFromBackend();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

window.addEventListener('DOMContentLoaded', () => {
    initializeSupabase();

    handleShareTokenInUrl();
});

window.shareConversation = shareConversation;
window.unshareConversation = unshareConversation;
window.joinConversation = joinConversation;
window.leaveConversation = leaveConversation;
window.showShareModal = showShareModal;
window.subscribeToConversation = subscribeToConversation;
window.unsubscribeFromConversation = unsubscribeFromConversation;
window.updatePresence = updatePresence;
