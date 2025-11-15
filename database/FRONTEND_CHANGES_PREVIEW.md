# Frontend Changes Preview

After you integrate the backend, here's what the frontend will need. **Don't implement yet** - this is just a preview.

---

## What Frontend Needs to Do

### 1. Track Current Conversation ID

**In script.js, add:**
```javascript
let currentConversationId = null;
```

### 2. Update Chat Payload

**Change the fetch payload to include conversation_id:**

```javascript
// BEFORE
const payload = {
    prompt,
    profile: currentProfileName,
    priorities: { ... },
    router_mode: routingMode,
    model_override: ...
};

// AFTER
const payload = {
    prompt,
    profile: currentProfileName,
    priorities: { ... },
    router_mode: routingMode,
    model_override: ...,
    conversation_id: currentConversationId,  // NEW
    user_id: "test-user-123"  // NEW (hardcoded for now)
};
```

### 3. Save Conversation ID from Response

**After getting the response:**

```javascript
const data = await response.json();

// Save the conversation ID for next message
currentConversationId = data.conversation_id;

// Display message as usual
addMessage('assistant', data.output, {
    model: data.model,
    provider: data.provider,
    score: data.routing_metadata?.score
});
```

### 4. Load Conversation History (Later)

When implementing conversation switching:

```javascript
async function loadConversation(conversationId) {
    const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`);
    const data = await response.json();

    // Clear current chat
    chatContainer.innerHTML = '';

    // Display all messages
    data.messages.forEach(msg => {
        addMessage(msg.role, msg.content, {
            model: msg.model,
            provider: msg.provider
        });
    });

    currentConversationId = conversationId;
}
```

### 5. New Chat Button

```javascript
function startNewChat() {
    // Reset conversation ID
    currentConversationId = null;

    // Clear chat display
    chatContainer.innerHTML = '<div class="welcome-message">Start a new conversation</div>';
}
```

---

## Full Frontend Features (Phase 2)

Later, you'll add:

### A. Conversation Sidebar
- List all conversations
- Click to switch between chats
- "New Chat" button
- Delete conversation button

### B. Conversation List UI
```html
<div class="conversations-sidebar">
    <button class="new-chat-btn">+ New Chat</button>

    <div class="conversations-list">
        <div class="conversation-item active">
            <h4>Chat about Python</h4>
            <span class="timestamp">2 hours ago</span>
        </div>
        <div class="conversation-item">
            <h4>Help with React</h4>
            <span class="timestamp">Yesterday</span>
        </div>
    </div>
</div>
```

### C. Load Conversations on Page Load
```javascript
async function loadConversations() {
    const response = await fetch(`${API_URL}/conversations?user_id=test-user-123`);
    const data = await response.json();

    displayConversationsList(data.conversations);
}
```

---

## For Now (Immediate Changes)

**Minimal changes to test database integration:**

1. ✅ Add `conversation_id` and `user_id` to chat payload
2. ✅ Save `conversation_id` from response
3. ✅ Include saved `conversation_id` in next message

**That's it!** These 3 changes will:
- Create a new conversation on first message
- Continue using same conversation for follow-up messages
- All messages saved to database automatically

---

## Testing the Integration

### Step 1: Make frontend changes
Just update the chat payload in `script.js`

### Step 2: Test in browser
1. Send message "Hello"
   - Backend creates new conversation
   - Returns `conversation_id`

2. Send message "How are you?"
   - Uses same `conversation_id`
   - Continues same conversation

### Step 3: Check Database
Go to Supabase → Table Editor → `messages`
- You should see both messages
- Same `conversation_id` for both

---

## What You Get

Even without the full UI:
- ✅ All messages saved to database
- ✅ Conversations persist
- ✅ Can load history via API
- ✅ Can build conversation UI later

The backend integration alone gives you **data persistence** - the UI can come later!

---

## Next: Full Conversation UI

When ready to build the full ChatGPT-style interface:
1. Add conversations sidebar
2. Fetch conversations on page load
3. Click to switch conversations
4. Load message history
5. New chat button
6. Delete conversation

But for now, just get the basic integration working!
