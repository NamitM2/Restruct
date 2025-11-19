"""
Test script for the streaming chat endpoint.

This script tests the /chat/stream endpoint to verify it sends:
1. Routing complete event
2. Inference complete event
"""

import requests
import json

API_URL = "http://localhost:8000"

def test_streaming_chat():
    """Test the streaming chat endpoint."""
    print("=" * 60)
    print("Testing /chat/stream endpoint")
    print("=" * 60)
    
    # First, create a conversation
    print("\n1. Creating conversation...")
    conv_response = requests.post(
        f"{API_URL}/conversations",
        params={"user_id": "test-user", "title": "Stream Test"}
    )
    
    if not conv_response.ok:
        print(f"❌ Failed to create conversation: {conv_response.status_code}")
        return
    
    conv_data = conv_response.json()
    conversation_id = conv_data["conversation"]["id"]
    print(f"✓ Created conversation: {conversation_id}")
    
    # Test streaming endpoint
    print("\n2. Testing streaming chat...")
    payload = {
        "prompt": "What is 2+2?",
        "conversation_id": conversation_id,
        "router_mode": "auto"
    }
    
    response = requests.post(
        f"{API_URL}/chat/stream",
        json=payload,
        stream=True
    )
    
    if not response.ok:
        print(f"❌ Request failed: {response.status_code}")
        print(response.text)
        return
    
    print("\n3. Receiving events...")
    event_count = 0
    
    for line in response.iter_lines():
        if line:
            line_str = line.decode('utf-8')
            if line_str.startswith('data: '):
                event_count += 1
                json_str = line_str[6:]  # Remove 'data: ' prefix
                event = json.loads(json_str)
                
                print(f"\n--- Event {event_count}: {event.get('status', 'unknown')} ---")
                
                if event.get('status') == 'routing_complete':
                    print(f"✓ Routing complete!")
                    print(f"  Model: {event.get('selected_model', {}).get('model_name')}")
                    print(f"  Provider: {event.get('selected_model', {}).get('provider')}")
                    print(f"  Routing time: {event.get('routing_time_ms')}ms")
                    print(f"  Model display: {event.get('model_display', {}).get('full_name')}")
                    print(f"  Logo URL: {event.get('model_display', {}).get('logo_url')}")
                
                elif event.get('status') == 'complete':
                    print(f"✓ Inference complete!")
                    print(f"  Response: {event.get('output', '')[:100]}...")
                    print(f"  Model: {event.get('model')}")
                    print(f"  Provider: {event.get('provider')}")
                    print(f"  Timing:")
                    timing = event.get('timing', {})
                    print(f"    - Routing: {timing.get('routing_time')}ms")
                    print(f"    - Inference: {timing.get('inference_time')}ms")
                    print(f"    - Total: {timing.get('total_time_ms')}ms")
                    print(f"  Usage:")
                    usage = event.get('usage', {})
                    print(f"    - Input tokens: {usage.get('input_tokens')}")
                    print(f"    - Output tokens: {usage.get('output_tokens')}")
                    print(f"    - Cost: {usage.get('cost_breakdown', {}).get('total_cost_formatted')}")
    
    print(f"\n{'=' * 60}")
    print(f"✓ Test complete! Received {event_count} events")
    print(f"{'=' * 60}")
    
    if event_count == 2:
        print("\n✅ SUCCESS: Both routing and inference events received!")
    else:
        print(f"\n⚠️  WARNING: Expected 2 events, got {event_count}")


if __name__ == "__main__":
    try:
        test_streaming_chat()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
