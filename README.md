# Gemini Caching Chatbot API

A powerful chatbot API using Google's Gemini AI with context caching capabilities, built with Node.js, Express, TypeScript, and PostgreSQL.

## Features

- 🤖 Google Gemini AI integration with context caching
- 📁 File upload support for profile/context documents
- 💬 Real-time streaming responses with Server-Sent Events (SSE)
- 🗄️ PostgreSQL database for cache management
- 📊 Token usage analytics and cost savings tracking
- 🔄 Conversation history management
- 🏥 Health check endpoints

## API Endpoints

### Core Endpoints
- `POST /api/create-cache` - Create a new cache with file upload
- `POST /api/ask` - Ask questions (supports streaming)
- `POST /api/start-chat` - Start a new chat session
- `GET /api/caches` - List all caches
- `PUT /api/cache/ttl` - Update cache TTL
- `DELETE /api/cache` - Delete cache
- `GET /api/token-analysis` - Get token usage analytics
- `GET /api/token-analysis/detailed` - Detailed token analytics
- `GET /api/history` - Get conversation history
- `POST /api/reset` - Reset conversation
- `GET /health` - Health check

### Database Endpoints
- `GET /api/db/caches` - List database caches
- `GET /api/db/cache/active` - Get active cache
- `GET /api/db/stats` - Get cache statistics
- `POST /api/db/cleanup` - Cleanup expired caches

## Deployment to Vercel

### Prerequisites
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
```

#### 4. Redeploy

After setting environment variables, trigger a new deployment:
- Through Vercel dashboard: Go to Deployments > Redeploy
- Through CLI: `vercel --prod`

### Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `GEMINI_API_KEY` | Google Gemini AI API key | Yes | - |
| `DB_HOST` | PostgreSQL host | Yes | localhost |
| `DB_PORT` | PostgreSQL port | No | 5432 |
| `DB_USER` | PostgreSQL username | Yes | postgres |
| `DB_PASSWORD` | PostgreSQL password | Yes | - |
| `DB_NAME` | PostgreSQL database name | No | gemini_cache_db |
| `NODE_ENV` | Environment mode | No | development |
| `PORT` | Server port | No | 3000 |

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
