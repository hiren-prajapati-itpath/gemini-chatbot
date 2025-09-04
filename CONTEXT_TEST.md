# Quick Context-Persistent Conversation Test

## Test Scenario: IT Path Solutions Health Card Solution Inquiry

This test demonstrates context persistence across 4 API calls with token usage tracking.

### Step 1: Start Chat Session with Company Profile

**Endpoint:** `POST /api/start-chat`

**Request Body:**
```json
{
  "sessionId": "health-card-inquiry-001",
  "initialMessage": "Hello! I'm interested in learning about IT Path Solutions and specifically your health card solutions. Can you tell me about your company and what health card services you offer?"
}
```

**Expected Response:**
- Company introduction from IT Path Solutions
- Overview of health card solutions
- Context saved in Redis with session ID

---

### Step 2: Follow-up - Technical Implementation Details

**Endpoint:** `POST /api/chat/health-card-inquiry-001/continue`

**Request Body:**
```json
{
  "message": "That sounds interesting! Can you provide more technical details about how your health card solution works? What technologies do you use and what features are included?"
}
```

**Expected Response:**
- Technical details about health card solution
- Technology stack information
- Features and capabilities
- Context maintained from previous conversation

---

### Step 3: Follow-up - In-House Implementation Interest

**Endpoint:** `POST /api/chat/health-card-inquiry-001/continue`

**Request Body:**
```json
{
  "message": "I'm interested in building a similar health card solution for my company in-house. What would be the key components I need to consider? Can you guide me on the architecture and development approach?"
}
```

**Expected Response:**
- Architecture recommendations
- Key components breakdown
- Development approach suggestions
- References to IT Path Solutions' experience
- Context awareness of previous discussion

---

### Step 4: Follow-up - Implementation Timeline and Resources

**Endpoint:** `POST /api/chat/health-card-inquiry-001/continue`

**Request Body:**
```json
{
  "message": "Based on your recommendations, what would be a realistic timeline for developing this in-house? What team size and skill sets would I need? Also, are there any common challenges I should be aware of?"
}
```

**Expected Response:**
- Timeline estimates
- Team requirements
- Required skill sets
- Common challenges and solutions
- Full context from all previous messages

---

### Step 5: Check Session Info and Token Usage

**Endpoint:** `GET /api/sessions/health-card-inquiry-001`

**Expected Response:**
```json
{
  "sessionId": "health-card-inquiry-001",
  "createdAt": "2025-09-03T...",
  "lastActivity": "2025-09-03T...",
  "messageCount": 4
}
```

**Token Analysis Endpoint:** `GET /api/token-analysis`

**Expected Response:**
```json
{
  "totalQuestions": 4,
  "totalTokensSaved": 1500,
  "estimatedSavings": "$0.15",
  "cacheEfficiency": "85%"
}
```

---

### Step 6: Retrieve Full Conversation History

**Endpoint:** `GET /api/sessions/health-card-inquiry-001/messages`

**Expected Response:**
```json
{
  "sessionId": "health-card-inquiry-001",
  "messages": [
    {
      "role": "user",
      "content": "Hello! I'm interested in learning about IT Path Solutions...",
      "timestamp": "2025-09-03T..."
    },
    {
      "role": "assistant", 
      "content": "Welcome! IT Path Solutions is a leading technology company...",
      "timestamp": "2025-09-03T..."
    },
    // ... all messages
  ],
  "count": 8,
  "historyType": "comprehensive"
}
```

---

## Quick Test Commands (using curl)

### 1. Start Chat
```bash
curl -X POST http://localhost:3000/api/start-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "health-card-inquiry-001",
    "initialMessage": "Hello! I'\''m interested in learning about IT Path Solutions and specifically your health card solutions. Can you tell me about your company and what health card services you offer?"
  }'
```

### 2. Continue Chat - Technical Details
```bash
curl -X POST http://localhost:3000/api/chat/health-card-inquiry-001/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "That sounds interesting! Can you provide more technical details about how your health card solution works? What technologies do you use and what features are included?"
  }'
```

### 3. Continue Chat - In-House Implementation
```bash
curl -X POST http://localhost:3000/api/chat/health-card-inquiry-001/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I'\''m interested in building a similar health card solution for my company in-house. What would be the key components I need to consider? Can you guide me on the architecture and development approach?"
  }'
```

### 4. Continue Chat - Timeline and Resources
```bash
curl -X POST http://localhost:3000/api/chat/health-card-inquiry-001/continue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Based on your recommendations, what would be a realistic timeline for developing this in-house? What team size and skill sets would I need? Also, are there any common challenges I should be aware of?"
  }'
```

### 5. Check Session Info
```bash
curl http://localhost:3000/api/sessions/health-card-inquiry-001
```

### 6. Check Token Usage
```bash
curl http://localhost:3000/api/token-analysis/detailed
```

### 7. Get Full Conversation
```bash
curl http://localhost:3000/api/sessions/health-card-inquiry-001/messages
```

---

## Expected Test Results

✅ **Context Persistence**: Each follow-up question should reference previous conversation  
✅ **Redis Storage**: Session data persisted in Redis with TTL  
✅ **Token Tracking**: Accurate token usage and cost analysis  
✅ **Cache Efficiency**: Reduced token costs due to context caching  
✅ **Session Management**: Proper session lifecycle management  

---

## Verification Points

1. **Response Quality**: AI should remember company context and previous questions
2. **Technical Continuity**: Each response builds on previous technical discussion
3. **Token Efficiency**: Cache hits should reduce billable tokens
4. **Session Persistence**: Session survives server restarts (Redis persistence)
5. **Analytics**: Token usage properly tracked and analyzed
