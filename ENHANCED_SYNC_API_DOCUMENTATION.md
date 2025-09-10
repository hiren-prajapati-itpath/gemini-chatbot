# Enhanced Universal Sync Service - API Documentation

## Overview

The Enhanced Universal Sync Service provides differential synchronization between WordPress and Markdown documents with the following key features:

- **Differential Sync**: Only fetches content modified since the last sync
- **Database State Management**: Stores sync metadata for tracking and optimization
- **Unified Processing**: Single function handles all content types
- **Precise Section Updates**: Updates only target sections while preserving other content
- **Comprehensive Logging**: Enhanced logging with filtering capabilities

## API Endpoints

### 1. Sync Status

#### Get All Sync Status
```bash
GET /api/enhanced-sync/status
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "contentType": "blogs",
      "lastSyncedAt": "2025-09-09T10:30:00.000Z",
      "lastModified": "2025-09-09T10:30:00.000Z",
      "totalItems": 45,
      "syncedItems": 45,
      "failedItems": 0,
      "syncStatus": "success",
      "syncDuration": 2500,
      "apiEndpoint": "/posts"
    }
  ],
  "timestamp": "2025-09-09T10:35:00.000Z"
}
```

#### Get Specific Content Type Status
```bash
GET /api/enhanced-sync/status/blogs
```

### 2. Manual Sync Operations

#### Trigger Manual Sync (All Content Types)
```bash
POST /api/enhanced-sync/manual
Content-Type: application/json

{
  "forceFullSync": false,
  "skipValidation": false
}
```

#### Trigger Manual Sync (Specific Content Types)
```bash
POST /api/enhanced-sync/manual
Content-Type: application/json

{
  "contentTypes": ["blogs", "solutions"],
  "forceFullSync": true,
  "skipValidation": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-09-09T10:30:00.000Z",
    "results": [
      {
        "contentType": "blogs",
        "success": true,
        "totalFetched": 5,
        "newItems": 3,
        "updatedItems": 2,
        "skippedItems": 0,
        "errors": [],
        "syncDuration": 1200,
        "lastSyncedAt": "2025-09-09T10:30:00.000Z"
      }
    ],
    "overallSuccess": true,
    "totalProcessed": 5,
    "totalNew": 3,
    "totalUpdated": 2,
    "totalSkipped": 0,
    "totalErrors": 0,
    "apiType": "rest",
    "isDifferentialSync": true
  },
  "message": "Manual sync completed successfully"
}
```

#### Full Sync
```bash
POST /api/enhanced-sync/full
Content-Type: application/json

{
  "skipValidation": false
}
```

#### Force Full Resync (Specific Content Type)
```bash
POST /api/enhanced-sync/force-resync/blogs
```

### 3. Document Validation

#### Validate Document Structure
```bash
GET /api/enhanced-sync/validate
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "missingeSections": [],
    "foundSections": ["blogs", "solutions", "caseStudies", "portfolio", "careers", "testimonials"],
    "recommendations": ["Document structure is valid"]
  },
  "message": "Document structure is valid"
}
```

### 4. Logging and Monitoring

#### Get Enhanced Logs
```bash
GET /api/enhanced-sync/logs?limit=50&level=all
```

#### Get Filtered Logs
```bash
GET /api/enhanced-sync/logs?contentType=blogs&level=error&since=2025-09-09T00:00:00.000Z&limit=20
```

**Parameters:**
- `limit` (number): Maximum number of log entries (default: 100)
- `contentType` (string): Filter by content type
- `level` (string): Filter by log level (all, error, success)
- `since` (ISO date): Show logs since this date

### 5. Cron Job Management

#### Start Enhanced Cron Job
```bash
POST /api/enhanced-sync/cron/start
```

### 6. Health Check

#### Service Health Check
```bash
GET /api/enhanced-sync/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "service": "Enhanced Universal Sync Service",
    "status": "healthy",
    "lastSync": "2025-09-09T10:30:00.000Z",
    "recentSyncs": 3,
    "totalContentTypes": 6,
    "activeContentTypes": 6,
    "failedContentTypes": 0
  },
  "timestamp": "2025-09-09T10:35:00.000Z"
}
```

## Migration Guide

### Step 1: Run Migration Script

The migration script will:
- Backup existing sync logs
- Initialize sync metadata in the database
- Validate document structure

```bash
# Run migration
npm run migrate:enhanced-sync
```

Or manually:
```typescript
import SyncMigrationService from './src/scripts/migrationToEnhancedSync';

const migration = new SyncMigrationService();
const result = await migration.runCompleteMigration();
console.log(result);
```

### Step 2: Test Enhanced Sync

```bash
# Test with a single content type
curl -X POST http://localhost:3000/api/enhanced-sync/manual \
  -H "Content-Type: application/json" \
  -d '{"contentTypes": ["blogs"]}'

# Check status
curl http://localhost:3000/api/enhanced-sync/status
```

### Step 3: Monitor Performance

```bash
# View recent logs
curl "http://localhost:3000/api/enhanced-sync/logs?limit=20&level=success"

# Check health
curl http://localhost:3000/api/enhanced-sync/health
```

## Key Features Explained

### 1. Differential Sync

The system uses the `after` parameter in WordPress API calls:
```
/wp-json/wp/v2/posts?after=2025-09-09T08:00:00.000Z
```

This ensures only content modified since the last sync is fetched, dramatically improving performance.

### 2. Database State Management

Each sync operation stores metadata:
- `lastSyncedAt`: Timestamp of last successful sync
- `totalItems`: Total items processed
- `syncedItems`: Successfully synced items
- `failedItems`: Failed items
- `syncStatus`: Overall sync status
- `syncDuration`: Time taken for sync

### 3. Unified Processing Logic

The `updateContentSection()` function handles all content types using:
- **targetSectionHeader**: Identifies the section to update
- **wpPostType**: Specifies WordPress content type
- **templateKey**: References the formatting template

### 4. Precise Section Updates

The system:
1. Identifies exact section boundaries using header markers
2. Preserves all content outside the target section
3. Replaces only the content between section markers
4. Maintains document structure integrity

## Content Type Configurations

```typescript
const contentConfigs = {
  blogs: {
    targetSectionHeader: '## **IT Path Solutions – Blog Insights**',
    wpPostType: 'posts',
    apiEndpoint: '/posts',
    templateKey: 'blogs'
  },
  solutions: {
    targetSectionHeader: '## **IT Path Solutions – Solutions Overview**',
    wpPostType: 'solutions',
    apiEndpoint: '/solutions',
    templateKey: 'solutions',
    subsectionHeader: '### **Featured Custom-Tailored Solutions**'
  }
  // ... other content types
};
```

## Error Handling

The system provides comprehensive error handling:

1. **API Errors**: WordPress API failures are logged and retried
2. **Document Errors**: File access issues are caught and reported
3. **Database Errors**: Sync metadata issues are handled gracefully
4. **Validation Errors**: Document structure problems are identified

## Performance Optimizations

1. **Differential Sync**: Only fetch new/modified content
2. **Pagination**: Handle large datasets efficiently
3. **Batch Processing**: Process content types in priority order
4. **Caching**: Store sync metadata to avoid unnecessary API calls
5. **Atomic Updates**: Update document sections precisely

## Monitoring and Debugging

### View Sync Performance
```bash
curl "http://localhost:3000/api/enhanced-sync/status" | jq '.data[] | {contentType, lastSyncedAt, syncDuration, syncStatus}'
```

### Monitor Recent Activity
```bash
curl "http://localhost:3000/api/enhanced-sync/logs?since=2025-09-09T00:00:00.000Z&level=success" | jq -r '.data[]'
```

### Debug Sync Issues
```bash
curl "http://localhost:3000/api/enhanced-sync/logs?level=error&limit=10" | jq -r '.data[]'
```

### Validate System Health
```bash
curl "http://localhost:3000/api/enhanced-sync/health" | jq '.data'
```

## Best Practices

1. **Regular Health Checks**: Monitor `/health` endpoint
2. **Log Review**: Regularly check logs for errors
3. **Validation**: Run document validation before major syncs
4. **Backup Strategy**: Always backup before major changes
5. **Incremental Testing**: Test with single content types first
6. **Performance Monitoring**: Track sync durations and optimize as needed

## Troubleshooting

### Common Issues

1. **Sync Fails**: Check WordPress API connectivity and credentials
2. **Document Not Updated**: Verify section headers match configuration
3. **Performance Issues**: Enable differential sync and monitor sync duration
4. **Database Errors**: Ensure database connection and table creation
5. **Template Issues**: Verify content type templates are properly configured
