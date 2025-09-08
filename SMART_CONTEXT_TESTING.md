# Smart Context Summarization Test Examples

## Test Scenario: Long Conversation

This example demonstrates how Smart Context Summarization works in practice.

### Setup
```bash
# Configure for testing (adjust as needed)
export ENABLE_SMART_SUMMARIZATION=true
export RECENT_MESSAGES_COUNT=6
export MIN_MESSAGES_FOR_SUMMARY=10
```

### Test API Calls

#### 1. Check Configuration
```bash
curl -X GET http://localhost:3000/api/context-config
```

#### 2. Start a Chat Session
```bash
curl -X POST http://localhost:3000/api/start-chat \
  -H "Content-Type: application/json" \
  -d '{
    "initialMessage": "Hello, I want to learn about your company"
  }'
```

#### 3. Continue the Conversation (Multiple Rounds)

Add several messages to reach the summarization threshold:

```bash
# Message 2
curl -X POST http://localhost:3000/api/continue-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id",
    "message": "Tell me about your services"
  }'

# Message 3
curl -X POST http://localhost:3000/api/continue-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id", 
    "message": "What about pricing?"
  }'

# ... continue until you have 12+ messages
```

#### 4. Observe Token Optimization

After reaching the threshold (10+ messages), check the logs for optimization:

```
📊 Smart Context Optimization:
   • Original: 12 messages (1,450 tokens)
   • Optimized: 7 messages (780 tokens)
   • Summarized: 6 messages → 1 summary
   • Recent: 6 messages kept intact
   • Token savings: 670 tokens (46.2%)
```

#### 5. Verify Context Preservation

Ask a question that references earlier conversation:

```bash
curl -X POST http://localhost:3000/api/continue-chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id",
    "message": "Based on what we discussed earlier about services, which would you recommend?"
  }'
```

The AI should still remember earlier conversation context despite summarization.

### Expected Behavior

1. **First 10 messages**: Normal token growth
2. **Messages 11+**: Token usage plateaus due to summarization  
3. **Context maintained**: AI remembers key points from summarized content
4. **Recent details preserved**: Last N messages kept in full detail

### Configuration Testing

#### Test Aggressive Summarization
```bash
curl -X PUT http://localhost:3000/api/context-config \
  -H "Content-Type: application/json" \
  -d '{
    "RECENT_MESSAGES_COUNT": 4,
    "MIN_MESSAGES_FOR_SUMMARY": 6
  }'
```

#### Test Conservative Summarization  
```bash
curl -X PUT http://localhost:3000/api/context-config \
  -H "Content-Type: application/json" \
  -d '{
    "RECENT_MESSAGES_COUNT": 12,
    "MIN_MESSAGES_FOR_SUMMARY": 20
  }'
```

#### Disable Summarization
```bash
curl -X PUT http://localhost:3000/api/context-config \
  -H "Content-Type: application/json" \
  -d '{
    "ENABLE_SMART_SUMMARIZATION": false
  }'
```

### Monitoring Token Usage

#### Get Detailed Analytics
```bash
curl -X GET http://localhost:3000/api/token-analysis/detailed?limit=20
```

Look for entries with `[Smart-Context: N msgs]` in the question field to identify optimized requests.

#### Cost Savings Analysis
```bash
curl -X GET http://localhost:3000/api/token-analysis
```

Compare conversations with and without summarization to see token savings.

### JavaScript/Node.js Test Script

```javascript
const axios = require('axios');

async function testSmartSummarization() {
    const baseURL = 'http://localhost:3000/api';
    
    // Start session
    const startResponse = await axios.post(`${baseURL}/start-chat`, {
        initialMessage: "Hello, tell me about your company"
    });
    
    const sessionId = startResponse.data.sessionId;
    console.log('Session started:', sessionId);
    
    // Add multiple messages
    const messages = [
        "What services do you offer?",
        "Tell me about pricing",
        "Do you have case studies?",
        "What about customer support?",
        "How long have you been in business?",
        "What makes you different from competitors?",
        "Can you show me some examples?",
        "What's your refund policy?",
        "How do I get started?",
        "Do you offer training?",
        "What about technical support?"
    ];
    
    for (let i = 0; i < messages.length; i++) {
        const response = await axios.post(`${baseURL}/continue-chat`, {
            sessionId,
            message: messages[i]
        });
        
        console.log(`Message ${i + 2}:`, {
            messageCount: response.data.messageCount,
            tokenUsage: response.data.tokenUsage
        });
        
        // Small delay to see logs clearly
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test context preservation
    const contextTest = await axios.post(`${baseURL}/continue-chat`, {
        sessionId,
        message: "Based on everything we discussed, what would you recommend for me?"
    });
    
    console.log('Context test result:', {
        response: contextTest.data.response.substring(0, 200) + '...',
        preservedContext: contextTest.data.response.includes('discussed') || 
                         contextTest.data.response.includes('based on')
    });
    
    // Get analytics
    const analytics = await axios.get(`${baseURL}/token-analysis`);
    console.log('Token savings:', analytics.data.inputComparison.saved);
}

testSmartSummarization().catch(console.error);
```

### Expected Results

With Smart Context Summarization enabled:
- ✅ Token usage plateaus after threshold
- ✅ 30-70% token savings in long conversations  
- ✅ Context preserved through summarization
- ✅ Recent conversation details maintained
- ✅ Natural conversation flow continues

Without Smart Context Summarization:
- ❌ Token usage grows linearly
- ❌ Higher costs for long conversations
- ✅ Full conversation history preserved (but expensive)
