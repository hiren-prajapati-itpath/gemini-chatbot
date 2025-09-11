# TTL Extension Testing Guide

## Test Scenario: TTL Extension for Expired Cache

This guide will help you test the TTL extension functionality when a cache expires but the document hasn't changed.

### Prerequisites
- Server running (`npm run dev`)
- Cache already created and expired
- Document unchanged since cache creation

### Test Steps

## Step 1: Create Initial Cache
```bash
# Create a chat session to generate initial cache
curl -X POST http://localhost:3000/api/chat/start \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, tell me about IT Path Solutions"}'
```

Expected: Cache created with 8-hour TTL

## Step 2: Force Cache Expiration (For Testing)
You have 3 options to test TTL extension:

### Option A: Wait for Natural Expiration (8 hours)
- Wait 8+ hours for cache to naturally expire
- Then proceed to Step 3

### Option B: Manually Expire Cache in Database
```sql
-- Connect to your PostgreSQL database
UPDATE "Caches" 
SET expire_time = NOW() - INTERVAL '1 hour', 
    is_active = false 
WHERE is_active = true;
```

### Option C: Temporarily Reduce TTL for Testing
1. Edit `.env` file:
```env
CACHE_TTL=60000  # 1 minute instead of 8 hours
```
2. Restart server
3. Create cache and wait 1 minute
4. Reset TTL back to normal: `CACHE_TTL=28800000` (8 hours)

## Step 3: Verify Cache Status
```bash
# Check current caches
curl -X GET http://localhost:3000/api/cache/enhanced/list
```

Expected response should show:
- `isActive: false`
- `expireTime` in the past

## Step 4: Trigger TTL Extension
```bash
# Start new chat (this should trigger TTL extension)
curl -X POST http://localhost:3000/api/chat/start \
  -H "Content-Type: application/json" \
  -d '{"message": "What services do you offer?"}'
```

### Expected Console Logs:
```
Cache invalid: expired_document_unchanged
⏰ Attempting TTL extension for startChat: Cache expired but document unchanged
✅ TTL extended successfully: cachedContents/[cache-id]
```

### Expected API Response:
```json
{
  "response": "...",
  "sessionId": "...",
  "cacheHit": true,
  "tokenUsage": {
    "cacheReused": true
  }
}
```

## Step 5: Verify TTL Extension in Database
```bash
# Check updated cache
curl -X GET http://localhost:3000/api/cache/enhanced/list
```

Expected changes:
- `isActive: true`
- `expireTime`: 8 hours from now
- `metadata.lastTtlExtension`: current timestamp

## Step 6: Test with continueChat
```bash
# Continue the conversation to test continueChat TTL extension
curl -X POST http://localhost:3000/api/chat/continue \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "[session-id-from-step-4]",
    "message": "Tell me more about your AI development services"
  }'
```

Expected: Should work without errors, reusing extended cache

## Verification Checklist

### ✅ Console Logs to Look For:
- [ ] `Cache invalid: expired_document_unchanged`
- [ ] `⏰ Attempting TTL extension for startChat: Cache expired but document unchanged`
- [ ] `✅ TTL extended successfully: cachedContents/[cache-id]`

### ✅ Database Changes:
- [ ] `expire_time` updated to 8 hours from now
- [ ] `is_active` changed from `false` to `true`
- [ ] `metadata.lastTtlExtension` shows current timestamp

### ✅ API Behavior:
- [ ] No cache recreation (no "Cache Created" logs)
- [ ] Response uses existing cached content
- [ ] Token usage shows cache reuse
- [ ] No errors in continueChat

### ✅ Cost Optimization:
- [ ] No new cache creation cost
- [ ] Only storage cost continues
- [ ] Cached tokens remain the same

## Troubleshooting

### If TTL Extension Fails:
1. **Check document hash**: Ensure `IT-Path-Solutions–Profile.md` hasn't changed
2. **Verify Gemini API**: Cache might not exist in Gemini anymore
3. **Check logs**: Look for specific error messages

### If Cache Gets Recreated Instead:
- This happens when document changed or Gemini cache is gone
- Check console for: `🔄 Lazy cache recreation triggered`
- Verify document timestamp and hash

### Common Issues:
1. **Document changed**: Extension won't work, cache will be recreated
2. **Gemini cache expired**: API-level expiration, will recreate
3. **Database/API mismatch**: Cache in DB but not in Gemini API

## Advanced Testing

### Test TTL Extension Limits (if implemented):
```bash
# Extend TTL multiple times to test limits
# Repeat Step 4 multiple times with short intervals
```

### Test Edge Cases:
1. **Multiple simultaneous requests**: Send concurrent requests when cache expired
2. **Document change during extension**: Modify document between expiry and extension
3. **Network issues**: Test with Gemini API temporarily unavailable

## Expected Performance

### Successful TTL Extension:
- **Speed**: ~200-500ms (no document upload/processing)
- **Cost**: Only storage cost, no creation cost
- **Tokens**: Same cached token count maintained

### vs Cache Recreation:
- **Speed**: ~2-5 seconds (document upload/processing)
- **Cost**: New creation cost (~$0.0004) + storage cost
- **Tokens**: New token count (may vary slightly)

## Monitoring

### Key Metrics to Track:
- TTL extension success rate
- Average extension time vs recreation time
- Cost savings from extensions vs recreations
- Document change frequency vs cache expiration frequency
