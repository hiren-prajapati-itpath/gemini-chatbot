# Context-Persistent Conversation API

## Overview
The enhanced chatbot now supports context-persistent conversations using session management. Each conversation maintains full context across multiple API calls, enabling natural follow-up questions and contextual references.

## Key Features
- ✅ **Session Management**: Create and manage persistent conversation sessions
- ✅ **Context Preservation**: Full conversation history maintained across API calls
- ✅ **Natural Follow-ups**: Handle references like "the services you mentioned" 
- ✅ **Cached Company Profile**: Efficient token usage with pre-cached IT Path Solutions profile
- ✅ **Session Lifecycle**: Automatic cleanup and session management

## API Endpoints

### Start New Conversation
```http
POST /api/start-chat
Content-Type: application/json

{
  "sessionId": "optional-custom-id",
  "initialMessage": "Hello, tell me about IT Path Solutions"
}
```

**Response:**
```json
{
  "sessionId": "session_1693737600_abc123def",
  "response": "Hello! I'm here to provide you with information about IT Path Solutions...",
  "messageCount": 2
}
```

### Continue Conversation
```http
POST /api/chat/{sessionId}/continue
Content-Type: application/json

{
  "message": "Tell me more about your mobile app development services"
}
```

**Response:**
```json
{
  "response": "Based on our previous discussion about IT Path Solutions services...",
  "sessionId": "session_1693737600_abc123def",
  "messageCount": 4,
  "tokenUsage": { ... }
}
```

### Get Session Information
```http
GET /api/sessions/{sessionId}
```

**Response:**
```json
{
  "sessionId": "session_1693737600_abc123def",
  "createdAt": "2025-09-03T10:30:00.000Z",
  "lastActivity": "2025-09-03T10:35:00.000Z",
  "messageCount": 4
}
```

### List Active Sessions
```http
GET /api/sessions
```

### Delete Session
```http
DELETE /api/sessions/{sessionId}
```

### Cleanup Inactive Sessions
```http
POST /api/sessions/cleanup
Content-Type: application/json

{
  "maxInactiveHours": 24
}
```

## Usage Examples

### Basic Conversation Flow
```javascript
// 1. Start conversation
const session = await fetch('/api/start-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    initialMessage: 'Show me recent blog posts from IT Path Solutions'
  })
});

// 2. Follow up with context
const followUp = await fetch(`/api/chat/${sessionId}/continue`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Now I want to build a solution based on the first blog you mentioned'
  })
});
```

### Context-Aware References
The chatbot understands contextual references:
- "the services you mentioned"
- "that blog post"
- "your company's approach"
- "the case study you showed"

## Session Management

### Automatic Session IDs
If no `sessionId` is provided, the system generates one automatically:
```
session_1693737600_abc123def
```

### Session Cleanup
- Sessions automatically cleaned up after 24 hours of inactivity
- Manual cleanup available via `/api/sessions/cleanup`
- Sessions can be deleted individually

## Benefits

1. **True Context Persistence**: Conversations continue meaningfully across API calls
2. **Natural IT Service Interactions**: Handle complex follow-ups about services, case studies, blogs
3. **Cost Efficient**: Leverages Gemini caching for company profile
4. **Scalable**: Support multiple concurrent users with isolated sessions
5. **Developer Friendly**: Simple REST API with clear session management

## Testing

Run the test script to see the feature in action:
```bash
npm run dev
# In another terminal:
node test-conversation.js
```

## Migration Notes

### Existing `/api/ask` Endpoint
- Still available for stateless questions
- For context-aware conversations, use the new session-based endpoints
- Consider migrating to session-based approach for better user experience
