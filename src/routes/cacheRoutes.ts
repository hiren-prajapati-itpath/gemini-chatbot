import { Router } from 'express';
import { GeminiCachingChatbot } from '../geminiCachingChatbot.js';
import multer from 'multer';

const router = Router();

// Configure multer for Vercel serverless environment
const upload = multer({
    dest: process.env.VERCEL ? '/tmp' : 'uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for Vercel
    }
});

export const createCacheRoutes = (chatBot: GeminiCachingChatbot) => {
    // Create a new cache with profile file
    router.post('/create-cache', upload.single('profileFile'), async (req, res) => {
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

    // List all caches
    router.get('/caches', async (req, res) => {
        try {
            const caches = await chatBot.listCaches();
            res.json(caches);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Update cache TTL
    router.put('/cache/ttl', async (req, res) => {
        try {
            const { ttl = '7200s' } = req.body;
            const result = await chatBot.updateCacheTTL(ttl);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Delete cache
    router.delete('/cache', async (req, res) => {
        try {
            await chatBot.deleteCache();
            res.json({ message: 'Cache deleted successfully' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
