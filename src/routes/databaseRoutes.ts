import { Router } from 'express';
import { CacheService } from '../services/CacheService.js';

const router = Router();

export const createDatabaseRoutes = () => {
    // List database caches
    router.get('/caches', async (req, res) => {
        try {
            const cacheService = new CacheService();
            const limit = req.query.limit ? Number(req.query.limit) : 50;
            const caches = await cacheService.listCaches(limit);
            res.json(caches);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get active cache
    router.get('/cache/active', async (req, res) => {
        try {
            const cacheService = new CacheService();
            const activeCache = await cacheService.getActiveCache();
            res.json(activeCache);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get cache statistics
    router.get('/stats', async (req, res) => {
        try {
            const cacheService = new CacheService();
            const stats = await cacheService.getCacheStats();
            res.json(stats);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Cleanup expired caches
    router.post('/cleanup', async (req, res) => {
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

    return router;
};
