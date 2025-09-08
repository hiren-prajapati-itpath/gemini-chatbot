# Gemini Caching Chatbot API

A powerful chatbot API using Google's Gemini AI with context caching capabilities, Smart Context Summarization, and comprehensive token optimization, built with Node.js, Express, TypeScript, and PostgreSQL.

## 🚀 Key Features

- 🤖 **Google Gemini AI Integration** with context caching
- 🧠 **Smart Context Summarization** - Automatic conversation optimization
- 📁 **File Upload Support** for profile/context documents  
- 💬 **Real-time Streaming** responses with Server-Sent Events (SSE)
- 🗄️ **PostgreSQL Database** for cache management
- 📊 **Advanced Token Analytics** and cost savings tracking
- 🔄 **Session Management** with Redis/In-Memory storage
- 💰 **Token Cost Optimization** with up to 70% savings
- 🏥 **Health Check Endpoints** for monitoring

## 🧠 Smart Context Summarization

### What It Does
Smart Context Summarization automatically optimizes long conversations by:
- **Summarizing older messages** to preserve key context
- **Keeping recent messages intact** for immediate context
- **Reducing token usage** by 30-70% in long conversations
- **Maintaining conversation quality** and user experience

### How It Works
```
Without Summarization:
Turn 1:  User + Cache = 50,050 tokens
Turn 10: User + Cache + 9 turns history = 52,450 tokens  
Turn 20: User + Cache + 19 turns history = 55,650 tokens
...grows linearly → expensive

With Smart Summarization:
Turn 1-15: Normal growth (under threshold)
Turn 16+:  [Summary of turns 1-6] + [Recent 10 turns] + Cache
Result:    Token usage plateaus → cost-effective
```

### Configuration
Set these environment variables to customize behavior:

```bash
# Enable smart summarization (default: true)
ENABLE_SMART_SUMMARIZATION=true

# Keep last N messages intact (default: 10)  
RECENT_MESSAGES_COUNT=10

# Start summarizing after N messages (default: 15)
MIN_MESSAGES_FOR_SUMMARY=15
```

See [SMART_CONTEXT_CONFIG.md](./SMART_CONTEXT_CONFIG.md) for detailed configuration guide.

## API Endpoints

### Core Chat Endpoints
- `POST /api/create-cache` - Create a new cache with file upload
- `POST /api/ask` - Ask questions (supports streaming)
- `POST /api/start-chat` - Start a new chat session
- `POST /api/continue-chat` - Continue existing chat session
- `GET /api/session/:sessionId/messages` - Get session message history
- `GET /api/session/:sessionId` - Get session information
- `GET /api/sessions` - List all active sessions
- `DELETE /api/session/:sessionId` - Delete a specific session
- `POST /api/sessions/cleanup` - Cleanup inactive sessions

### Cache Management
- `GET /api/caches` - List all caches
- `PUT /api/cache/ttl` - Update cache TTL
- `DELETE /api/cache` - Delete cache

### Analytics & Monitoring
- `GET /api/token-analysis` - Get token usage analytics
- `GET /api/token-analysis/detailed` - Detailed token analytics
- `GET /api/token-analysis/cost-savings` - Cost savings analysis
- `GET /api/context-config` - Get Smart Context configuration
- `PUT /api/context-config` - Update Smart Context settings
- `GET /health` - Health check

### Legacy Endpoints
- `GET /api/history` - Get conversation history
- `POST /api/reset` - Reset conversation

### Database Endpoints
- `GET /api/db/caches` - List database caches
- `GET /api/db/cache/active` - Get active cache
- `GET /api/db/stats` - Get cache statistics
- `POST /api/db/cleanup` - Cleanup expired caches

## Deployment

### Deploy to Render (Recommended for this setup)

#### Prerequisites
1. A Render account ([sign up here](https://render.com))
2. A PostgreSQL database
3. A Google Gemini API key

#### Step-by-Step Deployment

1. **Push your code to GitHub**
   - Make sure your code is in a GitHub repository

2. **Create a new Web Service on Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" and select "Web Service"
   - Connect your GitHub repository

3. **Configure the service** (IMPORTANT: Manual Configuration Required)
   - **Root Directory**: Leave blank (use repository root)
   - **Environment**: Node
   - **Region**: Oregon (recommended)
   - **Branch**: main (or your default branch)
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `node dist/index.js`
   - **Node Version**: 18.17.0 (or 18+)

   ⚠️ **CRITICAL**: Do NOT use `npm start` or `node src/index.ts` as the start command!

4. **Set Environment Variables**
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   DB_HOST=your_database_host
   DB_PORT=5432
   DB_USER=your_database_username
   DB_PASSWORD=your_database_password
   DB_NAME=gemini_cache_db
   NODE_ENV=production
   RENDER=true

   # Smart Context Summarization (Optional - Recommended)
   ENABLE_SMART_SUMMARIZATION=true
   RECENT_MESSAGES_COUNT=10
   MIN_MESSAGES_FOR_SUMMARY=15

   # Token Pricing (Optional - Use defaults if unsure)
   GEM_INPUT_PER_MTOK=0.10
   GEM_OUTPUT_PER_MTOK=0.40
   GEM_CACHE_CREATE_PER_MTOK=0.025
   GEM_CACHE_STORAGE_PER_MTOK_PER_HR=1.0
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy your application

### Deploy to Vercel

#### Prerequisites
1. A Vercel account ([sign up here](https://vercel.com))
2. A PostgreSQL database (recommendations below)
3. A Google Gemini API key

### Database Setup

You'll need a PostgreSQL database. Here are some recommended providers:

#### Option 1: Vercel Postgres (Recommended)
1. Go to your Vercel dashboard
2. Navigate to Storage > Create Database
3. Select PostgreSQL
4. Follow the setup instructions

#### Option 2: Supabase (Free tier available)
1. Go to [Supabase](https://supabase.com)
2. Create a new project
3. Get your database credentials from Settings > Database

#### Option 3: Railway
1. Go to [Railway](https://railway.app)
2. Create a new PostgreSQL database
3. Get your connection details

### Step-by-Step Deployment

#### 1. Get Your Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com)
2. Create an API key
3. Save it for the environment variables

#### 2. Deploy to Vercel

**Option A: Using Vercel CLI (Recommended)**

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from your project directory:
   ```bash
   vercel
   ```

4. Follow the prompts and set up your project

**Option B: Using Git Integration**

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your repository
5. Configure build settings (should auto-detect)

#### 3. Set Environment Variables

In your Vercel project dashboard, go to Settings > Environment Variables and add:

```env
GEMINI_API_KEY=your_gemini_api_key_here
DB_HOST=your_database_host
DB_PORT=5432
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_NAME=gemini_cache_db
NODE_ENV=production

# Smart Context Summarization (Optional)
ENABLE_SMART_SUMMARIZATION=true
RECENT_MESSAGES_COUNT=10
MIN_MESSAGES_FOR_SUMMARY=15

# Token Pricing Configuration (Optional)
GEM_INPUT_PER_MTOK=0.10
GEM_OUTPUT_PER_MTOK=0.40
GEM_CACHE_CREATE_PER_MTOK=0.025
GEM_CACHE_STORAGE_PER_MTOK_PER_HR=1.0

# Cache Configuration (Optional)
CACHE_TTL=28800s
GEMINI_MODEL=gemini-2.0-flash-001
```

#### 4. Redeploy

After setting environment variables, trigger a new deployment:
- Through Vercel dashboard: Go to Deployments > Redeploy
- Through CLI: `vercel --prod`

### Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| **Core Configuration** |
| `GEMINI_API_KEY` | Google Gemini AI API key | Yes | - |
| `DB_HOST` | PostgreSQL host | Yes | localhost |
| `DB_PORT` | PostgreSQL port | No | 5432 |
| `DB_USER` | PostgreSQL username | Yes | postgres |
| `DB_PASSWORD` | PostgreSQL password | Yes | - |
| `DB_NAME` | PostgreSQL database name | No | gemini_cache_db |
| `NODE_ENV` | Environment mode | No | development |
| `PORT` | Server port | No | 3000 |
| **Smart Context Summarization** |
| `ENABLE_SMART_SUMMARIZATION` | Enable/disable smart context optimization | No | true |
| `RECENT_MESSAGES_COUNT` | Number of recent messages to keep intact | No | 10 |
| `MIN_MESSAGES_FOR_SUMMARY` | Min messages before summarization starts | No | 15 |
| **Token Pricing (USD per 1M tokens)** |
| `GEM_INPUT_PER_MTOK` | Input token pricing | No | 0.10 |
| `GEM_OUTPUT_PER_MTOK` | Output token pricing | No | 0.40 |
| `GEM_CACHE_CREATE_PER_MTOK` | Cache creation pricing | No | 0.025 |
| `GEM_CACHE_STORAGE_PER_MTOK_PER_HR` | Cache storage per hour pricing | No | 1.0 |
| **Model Configuration** |
| `GEMINI_MODEL` | Gemini model to use | No | gemini-2.0-flash-001 |
| `CACHE_TTL` | Cache time-to-live | No | 28800s (8 hours) |

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Fill in your environment variables in `.env`

5. Run the development server:
   ```bash
   npm run dev
   ```

### Testing Your Deployment

Once deployed, test your API:

1. Health check:
   ```bash
   curl https://your-app.vercel.app/health
   ```

2. Create a cache (replace with your actual file):
   ```bash
   curl -X POST https://your-app.vercel.app/api/create-cache \
     -F "profileFile=@your-file.pdf"
   ```

3. Ask a question:
   ```bash
   curl -X POST https://your-app.vercel.app/api/ask \
     -H "Content-Type: application/json" \
     -d '{"question": "Hello, how are you?"}'
   ```

### Troubleshooting

#### Common Issues

1. **Database Connection Errors**
   - Verify your database credentials
   - Ensure your database allows connections from Vercel IPs
   - Check if your database is running

2. **Gemini API Errors**
   - Verify your API key is correct
   - Check your API quota/limits
   - Ensure the API key has necessary permissions

3. **File Upload Issues**
   - Vercel has a 50MB limit for serverless functions
   - Consider using external storage for large files

4. **Cold Start Issues**
   - First request might be slow due to serverless cold starts
   - Consider using Vercel's Edge Functions for better performance

#### Debug Mode

To enable debug logging, set:
```env
NODE_ENV=development
```

### Troubleshooting Render Deployment

#### Common Error: "Cannot find module 'geminiCachingChatbot.js'"

If you see this error:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/opt/render/project/src/src/geminiCachingChatbot.js'
```

**Cause**: Render is trying to run TypeScript files directly instead of compiled JavaScript.

**Solution**:
1. In your Render service settings, ensure:
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `node dist/index.js` (NOT `npm start` or `node src/index.ts`)

2. Check Environment Variables:
   - Ensure `NODE_ENV=production` is set
   - Add `RENDER=true` environment variable

3. Verify Node.js version:
   - Use Node.js 18.17.0 or higher
   - Check if `.nvmrc` file is being used

4. Manual Redeploy:
   - Go to your Render dashboard
   - Click "Manual Deploy" > "Deploy latest commit"

#### Common Issues

1. **Database Connection Errors**
   - Verify your database credentials
   - Ensure your database allows connections from Render IPs
   - Check if your database is running

2. **Gemini API Errors**
   - Verify your API key is correct
   - Check your API quota/limits
   - Ensure the API key has necessary permissions

3. **File Upload Issues**
   - Render uses `/tmp` directory for file uploads
   - Files are automatically cleaned up after request

4. **Build Failures**
   - Check Render build logs for TypeScript compilation errors
   - Ensure all dependencies are properly installed
   - Verify TypeScript configuration

### Performance Considerations

1. **Database Connection Pooling**: Consider using connection pooling for better performance
2. **File Storage**: For production, consider using cloud storage (AWS S3, Google Cloud Storage) instead of local uploads
3. **Caching**: The app already implements Gemini context caching for cost savings
4. **Rate Limiting**: Consider adding rate limiting for production use

### Security Best Practices

1. Never commit API keys or database credentials
2. Use environment variables for all sensitive data
3. Enable CORS only for trusted domains in production
4. Implement proper error handling to avoid exposing sensitive information
5. Consider adding authentication for production APIs

## Support

If you encounter any issues during deployment, check:
1. Vercel deployment logs
2. Database connection status  
3. Environment variable configuration
4. API key permissions

For more help, refer to:
- [Vercel Documentation](https://vercel.com/docs)
- [Google Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [TypeORM Documentation](https://typeorm.io/)
