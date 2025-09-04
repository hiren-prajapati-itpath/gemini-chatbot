# Context-Persistent Conversation - cURL Endpoints

## Prerequisites
Make sure the server is running:
```bash
npm run dev
```

## 1. Start New Conversation

### Basic start (auto-generated session ID)
```bash
curl -X POST http://localhost:3000/api/start-chat \
  -H "Content-Type: application/json" \
  -d '{
    "initialMessage": "Hello, tell me about IT Path Solutions services"
  }'
```

### Start with custom session ID
```bash
curl -X POST http://localhost:3000/api/start-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "my-custom-session-123",
    "initialMessage": "Hello, tell me about IT Path Solutions"
  }'
```

### Start without initial message (just create session)
```bash
curl -X POST http://localhost:3000/api/start-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "empty-session-456"
  }'
```

## 2. Continue Conversation (Context-Aware)

### Basic follow-up
```bash
curl -X POST http://localhost:3000/api/chat/my-custom-session-123/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me more about your mobile app development services"
  }'
```

### Context-aware follow-up with references
```bash
curl -X POST http://localhost:3000/api/chat/my-custom-session-123/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me some case studies for the services you just mentioned"
  }'
```

### Follow-up with pronouns (testing context resolution)
```bash
curl -X POST http://localhost:3000/api/chat/my-custom-session-123/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I want to build a solution based on that. What would you recommend?"
  }'
```

## 3. Session Management

### Get specific session information
```bash
curl -X GET http://localhost:3000/api/sessions/my-custom-session-123
```

### Get session chat messages/history
```bash
curl -X GET http://localhost:3000/api/sessions/my-custom-session-123/messages
```

### List all active sessions
```bash
curl -X GET http://localhost:3000/api/sessions
```

### Delete a specific session
```bash
curl -X DELETE http://localhost:3000/api/sessions/my-custom-session-123
```

### Cleanup inactive sessions (older than 24 hours)
```bash
curl -X POST http://localhost:3000/api/sessions/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "maxInactiveHours": 24
  }'
```

### Cleanup inactive sessions (custom timeout - 1 hour)
```bash
curl -X POST http://localhost:3000/api/sessions/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "maxInactiveHours": 1
  }'
```

## 4. Complete Conversation Flow Example

```bash
# Step 1: Start conversation
echo "🚀 Starting new conversation..."
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3000/api/start-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "demo-flow-789",
    "initialMessage": "Show me recent blog posts from IT Path Solutions"
  }')

echo "✅ Session started:"
echo $SESSION_RESPONSE | jq '.'

# Step 2: Continue with context-aware follow-up
echo -e "\n💬 Continuing conversation..."
curl -s -X POST http://localhost:3000/api/chat/demo-flow-789/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Now I want to build an e-commerce solution based on the first blog you mentioned"
  }' | jq '.'

# Step 3: Another follow-up with references
echo -e "\n🔗 Testing contextual references..."
curl -s -X POST http://localhost:3000/api/chat/demo-flow-789/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What technologies would you recommend for that solution?"
  }' | jq '.'

# Step 4: Get session info
echo -e "\n📊 Session information:"
curl -s -X GET http://localhost:3000/api/sessions/demo-flow-789 | jq '.'
```

## 5. Testing Error Scenarios

### Try to continue non-existent session
```bash
curl -X POST http://localhost:3000/api/chat/non-existent-session/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "This should fail"
  }'
```

### Try to create session with duplicate ID
```bash
# First create a session
curl -X POST http://localhost:3000/api/start-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "duplicate-test",
    "initialMessage": "First session"
  }'

# Try to create another with same ID (should fail)
curl -X POST http://localhost:3000/api/start-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "duplicate-test",
    "initialMessage": "Second session"
  }'
```

### Missing message in continue
```bash
curl -X POST http://localhost:3000/api/chat/demo-flow-789/continue \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 6. Performance Testing

### Create multiple sessions
```bash
for i in {1..5}; do
  echo "Creating session $i..."
  curl -s -X POST http://localhost:3000/api/start-chat \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"perf-test-$i\",
      \"initialMessage\": \"Hello from session $i\"
    }" | jq '.sessionId'
done

# List all sessions
echo "All active sessions:"
curl -s -X GET http://localhost:3000/api/sessions | jq '.'
```

## 7. Context Persistence Validation

### Test IT Service Chatbot Context
```bash
# Start with service inquiry
curl -X POST http://localhost:3000/api/start-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "it-service-test",
    "initialMessage": "I need help with mobile app development for my e-commerce business"
  }'

# Follow up with specific requirements
curl -X POST http://localhost:3000/api/chat/it-service-test/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What technologies do you recommend for the app I mentioned?"
  }'

# Reference previous context
curl -X POST http://localhost:3000/api/chat/it-service-test/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me case studies for similar e-commerce projects you have done"
  }'
```

## Expected Response Formats

### Start Chat Response
```json
{
  "sessionId": "session_1693737600_abc123def",
  "response": "Hello! I'm here to provide you with information about IT Path Solutions...",
  "messageCount": 2
}
```

### Continue Chat Response
```json
{
  "response": "Based on our previous discussion about your e-commerce mobile app...",
  "sessionId": "it-service-test",
  "messageCount": 4,
  "tokenUsage": {
    "promptTokenCount": 150,
    "candidatesTokenCount": 200
  }
}
```

### Session Info Response
```json
{
  "sessionId": "it-service-test",
  "createdAt": "2025-09-03T10:30:00.000Z",
  "lastActivity": "2025-09-03T10:35:00.000Z",
  "messageCount": 4
}
```

### Session Messages Response
```json
{
  "sessionId": "it-service-test",
  "messages": [
    {
      "role": "user",
      "content": "I need help with mobile app development",
      "timestamp": "2025-09-03T10:30:00.000Z",
      "sessionId": "it-service-test"
    },
    {
      "role": "assistant", 
      "content": "I'd be happy to help with mobile app development...",
      "timestamp": "2025-09-03T10:30:05.000Z",
      "sessionId": "it-service-test"
    },
    {
      "role": "user",
      "content": "What technologies do you recommend?",
      "timestamp": "2025-09-03T10:32:00.000Z", 
      "sessionId": "it-service-test"
    },
    {
      "role": "assistant",
      "content": "Based on your mobile app development needs...",
      "timestamp": "2025-09-03T10:32:05.000Z",
      "sessionId": "it-service-test"
    }
  ]
}
```

## Notes
- Replace `localhost:3000` with your actual server URL
- All session IDs must be unique
- Sessions are automatically cleaned up after 24 hours of inactivity
- The chatbot maintains full conversation context using Gemini's built-in history
- Company profile (IT Path Solutions) is cached for efficient token usage
