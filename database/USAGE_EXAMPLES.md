# Supabase Database Usage Examples

## Installation

```bash
pip install supabase
```

## Import and Setup

```python
from backend_code.database import (
    create_conversation,
    get_user_conversations,
    get_conversation_messages,
    add_message,
    update_conversation_title,
    delete_conversation
)
```

## Common Operations

### 1. Create a New Conversation

```python
# When user starts a new chat
conversation = create_conversation(
    user_id="user-uuid-here",
    title="Chat about Python"
)
print(f"Created conversation: {conversation['id']}")
```

### 2. Add Messages to Conversation

```python
conversation_id = "conv-uuid-here"

# Add user message
user_msg = add_message(
    conversation_id=conversation_id,
    role="user",
    content="What is the capital of France?"
)

# Add assistant response with routing metadata
assistant_msg = add_message(
    conversation_id=conversation_id,
    role="assistant",
    content="The capital of France is Paris.",
    model="gpt-4",
    provider="openai",
    profile_name="default",
    metadata={
        "latency": 250,
        "tokens": 15,
        "cost": 0.0012
    }
)
```

### 3. Get All User Conversations

```python
user_id = "user-uuid-here"
conversations = get_user_conversations(user_id)

for conv in conversations:
    print(f"{conv['title']} - {conv['created_at']}")
```

### 4. Load Conversation History

```python
conversation_id = "conv-uuid-here"
messages = get_conversation_messages(conversation_id)

for msg in messages:
    role = msg['role']
    content = msg['content']
    print(f"{role}: {content}")
```

### 5. Update Conversation Title

```python
# Auto-generate title from first message
update_conversation_title(
    conversation_id="conv-uuid-here",
    title="Discussion about French Geography"
)
```

### 6. Delete Conversation

```python
# Delete entire conversation (cascades to messages)
delete_conversation(conversation_id="conv-uuid-here")
```

## Example: Complete Chat Flow

```python
from backend_code.database import *

# 1. User starts new conversation
user_id = "auth-user-uuid"
conversation = create_conversation(user_id, "New Chat")
conv_id = conversation['id']

# 2. User sends first message
user_msg = add_message(
    conversation_id=conv_id,
    role="user",
    content="Hello! Can you help me with Python?"
)

# 3. Your router selects model and generates response
# (your existing routing logic)
response_text = "Of course! I'd be happy to help with Python."
model_used = "claude-sonnet-4.5"
provider_used = "anthropic"

# 4. Save assistant response
assistant_msg = add_message(
    conversation_id=conv_id,
    role="assistant",
    content=response_text,
    model=model_used,
    provider=provider_used,
    profile_name="default"
)

# 5. Later: Load conversation history
messages = get_conversation_messages(conv_id)
for msg in messages:
    print(f"{msg['role']}: {msg['content']}")
```

## Integration with Your Backend

### Update app.py Chat Endpoint

```python
from backend_code.database import add_message, create_conversation

@app.post("/chat")
async def chat(request: ChatRequest):
    # If no conversation_id provided, create new conversation
    if not request.conversation_id:
        conversation = create_conversation(
            user_id=request.user_id,  # You'll get this from auth
            title="New Chat"
        )
        conversation_id = conversation['id']
    else:
        conversation_id = request.conversation_id

    # Save user message
    add_message(
        conversation_id=conversation_id,
        role="user",
        content=request.prompt
    )

    # Your existing routing logic
    output = call_llm(request.prompt, ...)

    # Save assistant response
    add_message(
        conversation_id=conversation_id,
        role="assistant",
        content=output['text'],
        model=output['model'],
        provider=output['provider'],
        profile_name=request.profile
    )

    return {
        "conversation_id": conversation_id,
        "output": output['text'],
        "model": output['model']
    }
```

## Authentication Notes

For now, you can use a placeholder user_id for testing. Later, you'll implement:

1. User signup/login with Supabase Auth
2. Get authenticated user ID from JWT token
3. Pass user_id to all database functions

Example with auth (future):
```python
from supabase import create_client

# Get user from auth token
user = supabase.auth.get_user(jwt_token)
user_id = user.id

# Now use user_id in all database calls
conversations = get_user_conversations(user_id)
```
