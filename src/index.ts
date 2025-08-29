import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GeminiCachingChatbot } from './geminiCachingChatbot.js';
import { CacheService } from './services/CacheService.js';
import { initializeDatabase, closeDatabase } from './config/database.js';
import multer from 'multer';
import 'reflect-metadata';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY environment variable is missing');
    console.warn('⚠️  Some features will not work without the API key');
    console.warn('⚠️  Add GEMINI_API_KEY in your Render environment variables');
}

// Only initialize chatbot if API key is available
const chatBot = GEMINI_API_KEY ? new GeminiCachingChatbot(GEMINI_API_KEY) : null;

// Helper function to check if chatBot is available
const checkChatBot = (res: express.Response) => {
    if (!chatBot) {
        res.status(503).json({ 
            error: 'Service unavailable: GEMINI_API_KEY not configured',
            message: 'Please set GEMINI_API_KEY environment variable'
        });
        return false;
    }
    return true;
};

// Configure multer for serverless and cloud deployment environments
const upload = multer({
    dest: (process.env.VERCEL || process.env.RENDER) ? '/tmp' : 'uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for cloud platforms
    }
});

app.post('/api/create-cache', upload.single('profileFile'), async (req, res) => {
    try {
        if (!chatBot) {
            return res.status(503).json({ error: 'Service unavailable: GEMINI_API_KEY not configured' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Profile file is required' });
        }
        const filePath = req.file.path;
        const mimeType = req.file.mimetype;

        const result = await chatBot.createCompanyCache(filePath, mimeType);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ask', async (req, res) => {
    try {
        if (!checkChatBot(res)) return;
        
        const { question, useStreaming = false, maxTokens } = req.body as { question?: string; useStreaming?: boolean; maxTokens?: number };
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        if (useStreaming) {
            // Set up Server-Sent Events (SSE) headers
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');

            // Handle client disconnect
            let clientAborted = false;
            req.on('close', () => {
                clientAborted = true;
            });

            try {
                // Pass the response object directly to askQuestion for streaming
                if (!clientAborted && chatBot) {
                    await chatBot.askQuestion(question, true, maxTokens, res);
                }
            } catch (err: any) {
                if (!clientAborted) {
                    res.write(`data: ${JSON.stringify({ error: err?.message || 'Streaming failed' })}\n\n`);
                    res.end();
                }
            }
            return; // Prevent Express from trying to send another response
        }

        // Non-streaming JSON response
        const result = await chatBot!.askQuestion(question, false, maxTokens);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/start-chat', async (req, res) => {
    try {
        if (!checkChatBot(res)) return;
        const { initialMessage } = req.body;
        const result = await chatBot!.startChat(initialMessage);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/caches', async (req, res) => {
    try {
        if (!checkChatBot(res)) return;
        const caches = await chatBot!.listCaches();
        res.json(caches);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/cache/ttl', async (req, res) => {
    try {
        if (!checkChatBot(res)) return;
        const { ttl = '7200s' } = req.body;
        const result = await chatBot!.updateCacheTTL(ttl);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/cache', async (req, res) => {
    try {
        if (!checkChatBot(res)) return;
        await chatBot!.deleteCache();
        res.json({ message: 'Cache deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/token-analysis', (req, res) => {
    try {
        if (!checkChatBot(res)) return;
        const analysis = chatBot!.calculateCostSavings();
        res.json(analysis);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Detailed token analytics with per-question breakdown and means
app.get('/api/token-analysis/detailed', (req, res) => {
    try {
        if (!checkChatBot(res)) return;
        const limit = req.query.limit ? Number(req.query.limit) : 100;
        const summary = chatBot!.calculateCostSavings();
        const detailed = chatBot!.getTokenAnalyticsDetailed(limit);
        res.json({ summary, detailed });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/history', (req, res) => {
    try {
        if (!checkChatBot(res)) return;
        const history = chatBot!.getConversationHistory();
        res.json(history);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reset', (req, res) => {
    try {
        if (!checkChatBot(res)) return;
        chatBot!.resetConversation();
        res.json({ message: 'Conversation reset successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        geminiModel: 'gemini-2.5-flash',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        version: '1.0.0'
    });
});

// Simple endpoint that doesn't require database
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Gemini Context Caching Chatbot API',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/health',
            createCache: 'POST /api/create-cache',
            ask: 'POST /api/ask',
            caches: 'GET /api/caches',
            history: 'GET /api/history'
        }
    });
});

// Database-specific endpoints
app.get('/api/db/caches', async (req, res) => {
    try {
        const cacheService = new CacheService();
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const caches = await cacheService.listCaches(limit);
        res.json(caches);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/db/cache/active', async (req, res) => {
    try {
        const cacheService = new CacheService();
        const activeCache = await cacheService.getActiveCache();
        res.json(activeCache);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/db/stats', async (req, res) => {
    try {
        const cacheService = new CacheService();
        const stats = await cacheService.getCacheStats();
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/db/cleanup', async (req, res) => {
    try {
        const cacheService = new CacheService();
        const deletedCount = await cacheService.cleanupExpiredCaches();
        res.json({
            message: `Cleaned up ${deletedCount} expired cache records`,
            deletedCount
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await closeDatabase();
    process.exit(0);
});

const PORT = Number(process.env.PORT) || 3000;

// Start the server for all environments except serverless functions
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Gemini Context Caching Chatbot Server');
    console.log(`📡 Server running on http://0.0.0.0:${PORT}`);
    console.log('🤖 Using Gemini 2.5 Flash with explicit caching');
    console.log('📚 Documentation: https://ai.google.dev/gemini-api/docs/caching');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚀 Platform: ${process.env.RENDER ? 'Render' : 'Local'}`);
});

export default app;
