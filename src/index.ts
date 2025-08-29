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
    console.error('❌ GEMINI_API_KEY environment variable is required');
    process.exit(1);
}

const chatBot = new GeminiCachingChatbot(GEMINI_API_KEY);

// Configure multer for Vercel serverless environment
const upload = multer({ 
    dest: process.env.VERCEL ? '/tmp' : 'uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for Vercel
    }
});

app.post('/api/create-cache', upload.single('profileFile'), async (req, res) => {
    try {
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
                if (!clientAborted) {
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
        const result = await chatBot.askQuestion(question, false, maxTokens);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/start-chat', async (req, res) => {
    try {
        const { initialMessage } = req.body;
        const result = await chatBot.startChat(initialMessage);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/caches', async (req, res) => {
    try {
        const caches = await chatBot.listCaches();
        res.json(caches);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/cache/ttl', async (req, res) => {
    try {
        const { ttl = '7200s' } = req.body;
        const result = await chatBot.updateCacheTTL(ttl);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/cache', async (req, res) => {
    try {
        await chatBot.deleteCache();
        res.json({ message: 'Cache deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/token-analysis', (req, res) => {
    try {
        const analysis = chatBot.calculateCostSavings();
        res.json(analysis);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Detailed token analytics with per-question breakdown and means
app.get('/api/token-analysis/detailed', (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 100;
        const summary = chatBot.calculateCostSavings();
        const detailed = chatBot.getTokenAnalyticsDetailed(limit);
        res.json({ summary, detailed });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/history', (req, res) => {
    try {
        const history = chatBot.getConversationHistory();
        res.json(history);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reset', (req, res) => {
    try {
        chatBot.resetConversation();
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

const PORT = process.env.PORT || 3000;

// Only start the server if not running in Vercel environment
if (!process.env.VERCEL && !process.env.NOW_REGION) {
    app.listen(PORT, () => {
        console.log('🚀 Gemini Context Caching Chatbot Server');
        console.log(`📡 Server running on http://localhost:${PORT}`);
        console.log('🤖 Using Gemini 2.5 Flash with explicit caching');
        console.log('📚 Documentation: https://ai.google.dev/gemini-api/docs/caching');
    });
}

export default app;
