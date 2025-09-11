# Enhanced Caching Strategy for IT Service Chatbot

## Overview

This enhanced caching system provides intelligent cache management with document-aware invalidation and lazy recreation. It addresses the requirements for:

1. **Automatic cache invalidation** when the IT-Path-Solutions–Profile.md document is updated
2. **Configurable TTL** with 8-hour default expiry
3. **Lazy cache recreation** - caches are not auto-recreated when expired, only when requested
4. **Document change detection** using file hashing and modification timestamps

## Architecture

### Core Components

1. **EnhancedCacheService** - Advanced cache management with document tracking
2. **DocumentCacheModel** - Database model for tracking document-cache relationships
3. **DocumentWatcherService** - File system watcher for automatic invalidation
4. **Enhanced API Routes** - RESTful endpoints for cache management

### Cache Lifecycle

```
Document Update → File Watcher → Cache Invalidation → Lazy Recreation on Request
```

## Key Features

### 1. Document-Aware Cache Invalidation

- **File Hashing**: SHA-256 hash of document content for change detection
- **Timestamp Tracking**: Last modified time comparison
- **Automatic Invalidation**: File watcher detects changes and invalidates cache
- **Database Tracking**: Links between caches and document states

### 2. Intelligent TTL Management

- **TTL Extension**: Extends cache TTL when document unchanged but cache expired
- **Unlimited Extensions**: No limit on TTL extensions - always extend when document unchanged
- **Automatic Extension**: Enabled by default, can be disabled via environment
- **Fallback Recreation**: If TTL extension fails, falls back to cache recreation

### 3. Lazy Cache Recreation

- **On-Demand**: Caches are only recreated when requested (during `startChat` or `continueChat`)
- **Validation**: Every cache access validates against expiry and document changes
- **Priority Logic**: TTL Extension (unlimited) → Cache Recreation → Error
- **Fallback**: Automatic recreation from IT-Path-Solutions–Profile.md if invalid

### 4. Smart Expiry Handling

- **8-Hour TTL**: Default configurable cache expiry
- **Extension First**: Always try TTL extension before recreation when document unchanged
- **No Auto-Recreation**: Expired caches remain inactive until requested
- **Validation Chain**: TTL → Document Changes → Extension → Cache Validity

### 5. Enhanced Monitoring

- **Cache Statistics**: Total, active, expired, and document-invalid caches
- **Extension Tracking**: TTL extension timestamps and history
- **Validation Status**: Real-time cache validity checking with extension recommendations
- **Document Tracking**: Comprehensive audit trail

## Implementation

### Environment Variables

```env
# Cache Configuration
CACHE_TTL=28800s                    # 8 hours in seconds
AUTO_EXTEND_TTL=true                # Enable automatic TTL extension
GEMINI_API_KEY=your_api_key

# Database Configuration  
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=gemini_cache_db
DB_PORT=5432

# Document Watching
ENABLE_DOCUMENT_WATCHING=true       # Enable file system watcher
DOCUMENT_WATCH_DEBOUNCE=2000        # Debounce delay in milliseconds

# Smart Context (Optional)
RECENT_MESSAGES_COUNT=10
MIN_MESSAGES_FOR_SUMMARY=15
ENABLE_SMART_SUMMARIZATION=true
```

### Database Schema

#### document_caches table
```sql
CREATE TABLE document_caches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_path VARCHAR NOT NULL,
    document_hash VARCHAR NOT NULL,
    last_modified TIMESTAMP NOT NULL,
    cache_id UUID NOT NULL,
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

#### Cache Status
```http
GET /api/enhanced-cache/status
```

Response:
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 5,
      "active": 1,
      "expired": 2,
      "documentInvalid": 1,
      "totalTokens": 15000,
      "documentCacheEntries": 3
    },
    "activeCache": {
      "id": "uuid",
      "name": "cache_name",
      "model": "gemini-2.0-flash-001",
      "cachedTokens": 15000,
      "expireTime": "2025-09-11T08:00:00.000Z",
      "isActive": true
    },
    "shouldRecreate": false,
    "recreateReason": "valid",
    "hasDocumentChanged": false
  }
}
```

#### TTL Extension for Active Cache
```http
POST /api/enhanced-cache/extend-ttl-active
```

Response:
```json
{
  "success": true,
  "data": {
    "cacheId": "uuid",
    "cacheName": "cache_name",
    "message": "TTL extended successfully",
    "newExpireTime": "2025-09-11T16:00:00.000Z"
  }
}
```

#### TTL Extension for Specific Cache
```http
POST /api/enhanced-cache/extend-ttl/:cacheId
```

Response:
```json
{
  "success": true,
  "data": {
    "cacheId": "specific-uuid",
    "cacheName": "specific_cache_name",
    "message": "TTL extended successfully",
    "newExpireTime": "2025-09-11T16:00:00.000Z"
  }
}
```

#### Document Update Invalidation
```http
POST /api/enhanced-cache/invalidate-document
```

Response:
```json
{
  "success": true,
  "data": {
    "invalidatedCaches": 2,
    "message": "Invalidated 2 caches due to document update. New cache will be created lazily on next request."
  }
}
```

#### Cache Cleanup
```http
POST /api/enhanced-cache/cleanup
```

Response:
```json
{
  "success": true,
  "data": {
    "message": "Cleaned up 1 expired caches and 0 invalid document cache entries",
    "deletedCaches": 1,
    "invalidatedDocumentCaches": 0
  }
}
```

## Usage Examples

### 1. Basic Integration

```typescript
import { GeminiCachingChatbot } from './geminiCachingChatbot.js';
import { initializeDocumentWatcher } from './services/DocumentWatcherService.js';

// Initialize chatbot with enhanced caching
const chatbot = new GeminiCachingChatbot(process.env.GEMINI_API_KEY);

// Start document watcher for automatic invalidation
const documentWatcher = initializeDocumentWatcher();

// Ask questions - cache will be recreated lazily if invalid
const response = await chatbot.askQuestion("What services do you offer?");
```

### 2. Manual Cache Management

```typescript
import { EnhancedCacheService } from './services/EnhancedCacheService.js';

const cacheService = new EnhancedCacheService();

// Check if cache should be recreated
const recreateInfo = await cacheService.shouldRecreateCache();
if (recreateInfo.shouldRecreate) {
    console.log(`Cache needs recreation: ${recreateInfo.reason}`);
}

// Manually invalidate cache (useful for CI/CD)
await cacheService.invalidateCacheForDocumentUpdate();

// Get comprehensive cache statistics
const stats = await cacheService.getCacheStats();
console.log('Cache statistics:', stats);
```

### 3. Document Update Workflow

```typescript
// In your content management system or CI/CD pipeline:

// 1. Update the IT-Path-Solutions–Profile.md file
await fs.writeFile('IT-Path-Solutions–Profile.md', updatedContent);

// 2. Manually trigger cache invalidation (if file watcher is not available)
const cacheService = new EnhancedCacheService();
await cacheService.invalidateCacheForDocumentUpdate();

// 3. Next API request will automatically recreate the cache
const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: "Tell me about your services" })
});
```

## Enhanced Cache Decision Flow

```
Request Received (askQuestion/startChat/continueChat)
    ↓
Check if cache exists in memory
    ↓
[No Cache] → Load from database → [Not found] → Create new cache lazily
    ↓
[Cache exists] → Validate cache against TTL and document changes
    ↓
Cache validation results:
    ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. VALID: Use existing cache                                │
│ 2. EXPIRED + Document unchanged:                           │
│    → Extend TTL in Gemini API → Success? → Use cache       │
│                                     ↓                       │
│                                   Failed → Recreate cache  │
│ 3. DOCUMENT_CHANGED: → Recreate cache                      │
│ 5. NOT_FOUND: → Create new cache                           │
└─────────────────────────────────────────────────────────────┘
    ↓
Process request with valid cache
```

## TTL Extension Logic

```typescript
// Simplified validation decision tree
if (cache.expireTime && new Date() >= cache.expireTime) {
    const documentValid = validateDocumentCache(cache.id);
    
    if (documentValid && AUTO_EXTEND_TTL) {
        // Always try TTL extension when document unchanged
        return { shouldExtendTTL: true };
    } else if (!documentValid) {
        // Document changed - must recreate
        return { shouldRecreate: true };
    }
    
    // TTL extension disabled - lazy recreation
    return { shouldRecreate: false };
}

// TTL Extension Implementation
async extendTTL(cache) {
    try {
        // Use existing updateCacheTTL method from GeminiCachingChatbot
        const updatedCache = await this.updateCacheTTL(this.CACHE_TTL);
        
        // Update database with new expiry time
        await this.updateCache(cache.id, {
            expireTime: updatedCache.expireTime,
            metadata: { ...cache.metadata, lastTtlExtension: new Date() }
        });
        
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}
```

## Best Practices

### 1. Production Deployment

- **Database Connection Pooling**: Configure appropriate pool sizes
- **SSL/TLS**: Enable database SSL in production
- **Error Handling**: Implement comprehensive error recovery
- **Monitoring**: Set up alerts for cache recreation failures

### 2. Performance Optimization

- **Index Strategy**: Ensure proper database indexes on frequently queried fields
- **Cleanup Schedule**: Run regular cleanup jobs for expired caches
- **File Watcher Debouncing**: Prevent rapid invalidations during document editing

### 3. Security Considerations

- **Database Credentials**: Use secure credential management
- **File Permissions**: Restrict access to watched documents
- **API Rate Limiting**: Implement rate limiting on cache management endpoints

## Troubleshooting

### Common Issues

1. **Cache Not Recreating**
   - Check file permissions on IT-Path-Solutions–Profile.md
   - Verify database connectivity
   - Ensure GEMINI_API_KEY is valid

2. **File Watcher Not Working**
   - Check if file exists at expected path
   - Verify file system permissions
   - Look for debouncing delays

3. **Database Connection Issues**
   - Validate all DB_* environment variables
   - Check network connectivity
   - Verify SSL configuration

### Debug Mode

Enable debug logging:
```env
DB_SQL_LOGGING=true
NODE_ENV=development
```

### Health Check

Monitor system health:
```http
GET /api/enhanced-cache/status
```

## Migration Guide

### From Basic Caching

1. **Update Dependencies**: Install new enhanced services
2. **Database Migration**: Add document_caches table
3. **Update Configuration**: Add environment variables
4. **Update Routes**: Include enhanced cache routes
5. **Initialize Watcher**: Start document watcher service

### Testing

```typescript
// Test cache invalidation
const cacheService = new EnhancedCacheService();
const initialStats = await cacheService.getCacheStats();

// Trigger invalidation
await cacheService.invalidateCacheForDocumentUpdate();

// Verify invalidation
const updatedStats = await cacheService.getCacheStats();
assert(updatedStats.active < initialStats.active);
```

## Conclusion

This enhanced caching strategy provides a robust, scalable solution for managing Gemini API caches with intelligent document-aware invalidation. The lazy recreation pattern ensures optimal resource usage while maintaining data consistency and freshness.
