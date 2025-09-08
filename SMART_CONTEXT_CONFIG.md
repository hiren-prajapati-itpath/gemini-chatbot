# Smart Context Summarization Configuration

## Overview
Smart Context Summarization optimizes token usage by summarizing older conversation messages while keeping recent messages intact. This maintains conversation quality while reducing costs.

## Environment Variables

### Smart Context Configuration
```bash
# Enable/disable smart context summarization (default: true)
ENABLE_SMART_SUMMARIZATION=true

# Number of recent messages to keep intact (default: 10)
RECENT_MESSAGES_COUNT=10

# Minimum messages required before summarization kicks in (default: 15)
MIN_MESSAGES_FOR_SUMMARY=15
```

### Token Pricing Configuration
```bash
# Gemini pricing per 1M tokens (default values)
GEM_INPUT_PER_MTOK=0.10
GEM_OUTPUT_PER_MTOK=0.40
GEM_CACHE_CREATE_PER_MTOK=0.025
GEM_CACHE_STORAGE_PER_MTOK_PER_HR=1.0
```

## How It Works

### Without Smart Summarization
```
Turn 1: User message + Cache = 50,050 tokens
Turn 2: User message + Cache + Turn 1 history = 50,310 tokens  
Turn 3: User message + Cache + Turn 1-2 history = 50,590 tokens
...grows linearly with each turn
```

### With Smart Summarization
```
Turn 1-15: Normal growth (under MIN_MESSAGES_FOR_SUMMARY)
Turn 16+: Older messages summarized + 10 recent messages kept
Result: Token usage plateaus instead of growing indefinitely
```

## Benefits

### Token Savings
- **Before**: Linear growth (each message adds to history)
- **After**: Plateau effect (history stays manageable)
- **Savings**: 30-70% token reduction in long conversations

### Context Preservation
- ✅ Recent conversations fully preserved
- ✅ Key information from older messages summarized
- ✅ User preferences and decisions maintained
- ✅ Conversation flow remains natural

## Configuration Examples

### Conservative (High Quality)
```bash
ENABLE_SMART_SUMMARIZATION=true
RECENT_MESSAGES_COUNT=15
MIN_MESSAGES_FOR_SUMMARY=20
```

### Aggressive (High Savings)
```bash
ENABLE_SMART_SUMMARIZATION=true
RECENT_MESSAGES_COUNT=6
MIN_MESSAGES_FOR_SUMMARY=10
```

### Disabled (Original Behavior)
```bash
ENABLE_SMART_SUMMARIZATION=false
```

## Runtime Configuration

You can also update configuration programmatically:

```typescript
// Get current configuration
const config = chatbot.getContextConfig();
console.log(config);

// Update configuration
chatbot.updateContextConfig({
    RECENT_MESSAGES_COUNT: 8,
    MIN_MESSAGES_FOR_SUMMARY: 12
});
```

## Monitoring

The system provides detailed logging for each optimization:

```
📊 Smart Context Optimization:
   • Original: 25 messages (1,250 tokens)
   • Optimized: 11 messages (620 tokens)
   • Summarized: 15 messages → 1 summary
   • Recent: 10 messages kept intact
   • Token savings: 630 tokens (50.4%)
```

## Best Practices

1. **Monitor token usage** - Check logs to see actual savings
2. **Adjust based on use case** - Longer conversations benefit more
3. **Test with your data** - Different conversation patterns have different optimal settings
4. **Consider context importance** - Some applications need more recent messages
5. **Balance cost vs quality** - Find the sweet spot for your needs
