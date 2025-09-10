# Universal Sync System Documentation

## Overview

The Universal Sync System is a comprehensive WordPress-to-Document synchronization solution that automatically fetches content from your WordPress site and updates your local documents. It supports multiple content types and provides both REST API and GraphQL integration with configurable API selection.

## Features

### 🔄 WordPress to Document Sync
- **WordPress to Document**: Fetches latest content from WordPress and updates your local documents
- **API Support**: Choose between REST API or GraphQL for data fetching
- **Content Preservation**: Maintains document structure while updating content sections

### 📅 Automated Scheduling
- **Cron Jobs**: Configurable automatic sync schedules (default: every 6 hours)
- **Manual Triggers**: On-demand sync via API endpoints
- **Selective Sync**: Sync specific content types or all at once

### 📄 Content Types Supported

#### 1. **Blogs** (`/posts`)
- Company blog posts with title, content, excerpt
- Categories and tags support
- Author information
- Publication status (draft, published)

#### 2. **Solutions** (`/solutions`)
- Service offerings categorized by industry
- Technology stack information
- Features and descriptions
- Status tracking (active, inactive)

#### 3. **Case Studies** (`/case_studies`)
- Client project showcases
- Challenge, solution, and results sections
- Industry and client information
- Project duration and team size

#### 4. **Portfolio** (`/portfolio_items`)
- Project showcase with descriptions
- Technology stack and categories
- Live URLs and GitHub links
- Completion status tracking

#### 5. **Careers** (`/job_openings`)
- Job openings with requirements
- Department and experience levels
- Salary ranges and benefits
- Urgency flags for priority positions

#### 6. **Testimonials** (`/testimonials`)
- Client feedback with ratings
- Company and position information
- Featured testimonials
- Project type associations

## Installation & Setup

### 1. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.sync.example .env
```

Configure the following variables:

```env
# WordPress Configuration
WP_BASE_URL=https://your-site.com/wp-json/wp/v2
WP_USERNAME=your_username
WP_PASSWORD=your_app_password
WP_GRAPHQL_URL=https://your-site.com/graphql

# API Type Selection - Choose between 'rest' or 'graphql'
WP_API_TYPE=rest

# Sync Settings
ENABLE_AUTO_SYNC=true
SYNC_INTERVAL=0 */6 * * *
DOCUMENT_PATH=./IT_Path_Solutions_Profile.md
```

### 2. WordPress Setup

#### Required Plugins
- **Custom Post Type UI** (for custom post types)
- **WPGraphQL** (for GraphQL support)
- **Advanced Custom Fields** (for custom fields)

#### Custom Post Types Registration
Add this to your WordPress theme's `functions.php`:

```php
function register_custom_post_types() {
    // Solutions
    register_post_type('solutions', [
        'public' => true,
        'show_in_rest' => true,
        'rest_base' => 'solutions',
        'supports' => ['title', 'editor', 'custom-fields'],
        'show_in_graphql' => true,
        'graphql_single_name' => 'solution',
        'graphql_plural_name' => 'solutions'
    ]);
    
    // Case Studies
    register_post_type('case_studies', [
        'public' => true,
        'show_in_rest' => true,
        'rest_base' => 'case_studies',
        'supports' => ['title', 'editor', 'custom-fields'],
        'show_in_graphql' => true,
        'graphql_single_name' => 'caseStudy',
        'graphql_plural_name' => 'caseStudies'
    ]);
    
    // Portfolio Items
    register_post_type('portfolio_items', [
        'public' => true,
        'show_in_rest' => true,
        'rest_base' => 'portfolio_items',
        'supports' => ['title', 'editor', 'custom-fields'],
        'show_in_graphql' => true,
        'graphql_single_name' => 'portfolioItem',
        'graphql_plural_name' => 'portfolioItems'
    ]);
    
    // Job Openings
    register_post_type('job_openings', [
        'public' => true,
        'show_in_rest' => true,
        'rest_base' => 'job_openings',
        'supports' => ['title', 'editor', 'custom-fields'],
        'show_in_graphql' => true,
        'graphql_single_name' => 'jobOpening',
        'graphql_plural_name' => 'jobOpenings'
    ]);
    
    // Testimonials
    register_post_type('testimonials', [
        'public' => true,
        'show_in_rest' => true,
        'rest_base' => 'testimonials',
        'supports' => ['title', 'editor', 'custom-fields'],
        'show_in_graphql' => true,
        'graphql_single_name' => 'testimonial',
        'graphql_plural_name' => 'testimonials'
    ]);
}
add_action('init', 'register_custom_post_types');
```

### 3. Document Structure

Your document should follow this structure:

```markdown
# IT Path Solutions Profile

## **IT Path Solutions -- Blog Insights**
*Let's empower with knowledge and help businesses innovate through technological decisions.*

### **Latest Blog Posts**

- **Blog Title**
  *Posted on January 1, 2024 by Author Name*
  https://example.com/blog-post
  Blog excerpt here...

## **Our Solutions**
*Comprehensive IT solutions tailored for various industries.*

### **Solution Title**
*Category: Health*

Solution description here...

**Technologies:** React, Node.js, MongoDB

## **Case Studies**
*Real-world projects showcasing our expertise and client success stories.*

### **Project Title**
*Client: Client Name*
*Industry: Healthcare*

Project description...

**Challenge:** Challenge description
**Solution:** Solution description
**Results:** Results achieved

## **Portfolio**
*Showcase of our completed projects and technical capabilities.*

### **Project Name**
*Category: Web Development*

Project description...

**Technologies:** React, Node.js
**Live URL:** https://example.com
**GitHub:** https://github.com/user/repo

## **Career Opportunities**
*Join our team and build the future of technology solutions.*

### **Job Title**
*Department: Engineering*
*Experience: 3+ years*
*Location: Remote*
*Type: Full-time*

Job description...

**Salary Range:** $80,000 - $120,000

## **Client Testimonials**
*What our clients say about working with IT Path Solutions.*

### **Client Name**
*Position, Company Name*

"Testimonial content here..."

**Rating:** ★★★★★
```

## API Endpoints

### Sync Operations

#### Start Auto Sync
```http
POST /api/sync/start-auto-sync
```

#### Full Manual Sync
```http
POST /api/sync/full
```

#### Selective Sync
```http
POST /api/sync/selective
Content-Type: application/json

{
  "contentTypes": ["blogs", "solutions"]
}
```

#### Sync Specific Content Type
```http
POST /api/sync/:contentType
```

### Content Operations

#### Get All Content
```http
GET /api/sync/content/:contentType?page=1&limit=10
```

#### Get Content by ID
```http
GET /api/sync/content/:contentType/:id
```

#### Create Content
```http
POST /api/sync/content/:contentType
Content-Type: application/json

{
  "title": "Content Title",
  "description": "Content Description",
  // ... other fields
}
```

#### Update Content
```http
PUT /api/sync/content/:contentType/:id
Content-Type: application/json

{
  "title": "Updated Title",
  // ... other fields
}
```

#### Delete Content
```http
DELETE /api/sync/content/:contentType/:id?force=false
```

### Specialized Endpoints

#### Blogs
```http
GET /api/sync/blogs/published
GET /api/sync/blogs/category/:category
```

#### Solutions
```http
GET /api/sync/solutions/category/:category
```

#### Case Studies
```http
GET /api/sync/case-studies/industry/:industry
```

#### Careers
```http
GET /api/sync/careers/active
GET /api/sync/careers/urgent
```

#### Testimonials
```http
GET /api/sync/testimonials/featured
```

### System Operations

#### Get Sync Logs
```http
GET /api/sync/logs?limit=100
```

#### Get System Status
```http
GET /api/sync/status
```

#### Get Sync Configuration
```http
GET /api/sync/config
```

#### Update API Type
```http
POST /api/sync/config/api-type
Content-Type: application/json

{
  "apiType": "rest"
}
```

## Usage Examples

### Starting the Sync System

```typescript
import UniversalSyncService from './services/UniversalSyncService';

const syncService = new UniversalSyncService();

// Start automatic sync
syncService.startCronJob();

// Manual full sync
const report = await syncService.performFullSync();
console.log('Sync completed:', report);

// Sync specific content types
const selectiveReport = await syncService.manualSync(['blogs', 'solutions']);
console.log('Selective sync completed:', selectiveReport);
```

### Using Content Services

```typescript
import { ContentServiceFactory } from './services/ContentTypeServices';

// Get blog service
const blogService = ContentServiceFactory.getService('blogs');

// Create a new blog post
const newBlog = await blogService.create({
  title: 'New Blog Post',
  content: 'Blog content here...',
  status: 'publish'
});

// Get published blogs
const publishedBlogs = await blogService.getPublished();
```

### API Usage

```javascript
// Start full sync
const response = await fetch('/api/sync/full', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

const result = await response.json();
console.log('Sync result:', result);

// Get all solutions
const solutions = await fetch('/api/sync/content/solutions');
const solutionsData = await solutions.json();

// Update API type configuration
const configResponse = await fetch('/api/sync/config/api-type', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ apiType: 'graphql' })
});
```

## Monitoring & Logging

### Log Files
- **Universal Sync Log**: `./universal-sync.log`
- **Error Logs**: Integrated with main application logging
- **Performance Metrics**: Sync duration and success rates

### Monitoring Endpoints
```http
GET /api/sync/status      # System status
GET /api/sync/logs        # Recent sync logs
```

### Health Checks
The system includes built-in health checks for:
- WordPress connectivity
- Document file accessibility
- Sync service status
- Content type availability

## Troubleshooting

### Common Issues

#### 1. WordPress Connection Failed
- Verify `WP_USERNAME` and `WP_PASSWORD` in `.env`
- Ensure WordPress Application Passwords are enabled
- Check WordPress REST API accessibility

#### 2. Document Not Found
- Verify `DOCUMENT_PATH` points to correct file
- Ensure file permissions allow read/write access
- Check if backup directory exists

#### 3. Custom Post Types Not Found
- Verify custom post types are registered in WordPress
- Check REST API exposure settings
- Ensure GraphQL plugin is active for GraphQL queries

#### 4. Sync Failures
- Check sync logs for detailed error messages
- Verify network connectivity to WordPress site
- Ensure sufficient disk space for backups

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=sync:*
```

## Performance Optimization

### Best Practices
1. **Batch Processing**: Large sync operations are processed in batches
2. **Incremental Sync**: Only changed content is synchronized
3. **Caching**: Frequently accessed data is cached
4. **Rate Limiting**: API calls are rate-limited to prevent overload

### Configuration Tuning
```env
# Adjust batch sizes
WP_POSTS_PER_PAGE=50
WP_MAX_PAGES=10

# Retry configuration
MAX_RETRIES=3
RETRY_DELAY=5000
```

## Security Considerations

1. **Credentials**: Store WordPress credentials securely in environment variables
2. **File Permissions**: Ensure document files have appropriate read/write permissions
3. **API Access**: Implement proper authentication for sync API endpoints
4. **Backup Security**: Secure backup files and implement retention policies

## Support & Maintenance

### Regular Maintenance
- Monitor sync logs for errors
- Review and clean up old backup files
- Update WordPress and plugin versions
- Test sync operations after WordPress updates

### Backup Strategy
- Automatic backups before document updates
- Configurable backup retention period
- Manual backup triggers available via API

## Migration Guide

### From Legacy Blog Sync
If migrating from the legacy `BlogSyncManager`:

1. Update environment variables to new format
2. Test with individual content types first
3. Gradually enable all content types
4. Monitor logs during transition period

### WordPress Migration
When changing WordPress sites:

1. Update `WP_BASE_URL` and credentials
2. Re-register custom post types on new site
3. Run full sync to populate new WordPress instance
4. Verify all content types are working correctly

---

For additional support or feature requests, please refer to the project documentation or contact the development team.
