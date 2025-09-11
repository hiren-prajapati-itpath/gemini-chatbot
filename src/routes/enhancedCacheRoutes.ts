import { Router, Request, Response } from 'express';
import { EnhancedCacheService } from '../services/EnhancedCacheService.js';

const router = Router();

/**
 * Enhanced cache management routes
 */

/**
 * GET /api/cache/status - Get cache status with document validation
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const enhancedCacheService = new EnhancedCacheService();
        const stats = await enhancedCacheService.getCacheStats();
        const shouldRecreate = await enhancedCacheService.shouldRecreateCache();
        const activeCache = await enhancedCacheService.getActiveCache();

        res.json({
            success: true,
            data: {
                stats,
                activeCache: activeCache ? {
                    id: activeCache.id,
                    name: activeCache.name,
                    model: activeCache.model,
                    cachedTokens: activeCache.cachedTokens,
                    expireTime: activeCache.expireTime,
                    createdAt: activeCache.createdAt,
                    isActive: activeCache.isActive
                } : null,
                shouldRecreate: shouldRecreate.shouldRecreate,
                recreateReason: shouldRecreate.reason,
                hasDocumentChanged: shouldRecreate.hasDocumentChanged
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to get cache status',
            details: error.message
        });
    }
});

/**
 * GET /api/cache/list - List all caches with validation status
 */
router.get('/list', async (req: Request, res: Response) => {
    try {
        const enhancedCacheService = new EnhancedCacheService();
        const limit = parseInt(req.query.limit as string) || 50;
        const cachesWithValidation = await enhancedCacheService.listCaches(limit);

        res.json({
            success: true,
            data: {
                caches: cachesWithValidation.map(cache => ({
                    id: cache.id,
                    name: cache.name,
                    model: cache.model,
                    cachedTokens: cache.cachedTokens,
                    expireTime: cache.expireTime,
                    isActive: cache.isActive,
                    createdAt: cache.createdAt,
                    updatedAt: cache.updatedAt,
                    validationStatus: (cache as any).validationStatus
                })),
                total: cachesWithValidation.length
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to list caches',
            details: error.message
        });
    }
});

/**
 * POST /api/cache/extend-ttl/:cacheId - Extend TTL for specific cache
 */
router.post('/extend-ttl/:cacheId', async (req: Request, res: Response) => {
    try {
        const { cacheId } = req.params;
        const enhancedCacheService = new EnhancedCacheService();
        
        // Find cache by ID
        const caches = await enhancedCacheService.listCaches(1000);
        const cache = caches.find(c => c.id === cacheId);
        
        if (!cache) {
            return res.status(404).json({
                success: false,
                error: 'Cache not found'
            });
        }

        const result = await enhancedCacheService.extendCacheTTL(cache);

        res.json({
            success: result.success,
            data: {
                cacheId,
                cacheName: cache.name,
                message: result.message,
                newExpireTime: result.newExpireTime
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to extend cache TTL',
            details: error.message
        });
    }
});

/**
 * POST /api/cache/extend-ttl-active - Extend TTL for active cache
 */
router.post('/extend-ttl-active', async (req: Request, res: Response) => {
    try {
        const enhancedCacheService = new EnhancedCacheService();
        const activeCache = await enhancedCacheService.getActiveCache();
        
        if (!activeCache) {
            return res.status(404).json({
                success: false,
                error: 'No active cache found'
            });
        }

        const result = await enhancedCacheService.extendCacheTTL(activeCache);

        res.json({
            success: result.success,
            data: {
                cacheId: activeCache.id,
                cacheName: activeCache.name,
                message: result.message,
                newExpireTime: result.newExpireTime
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to extend active cache TTL',
            details: error.message
        });
    }
});

/**
 * POST /api/cache/invalidate-document - Invalidate cache when document is updated
 */
router.post('/invalidate-document', async (req: Request, res: Response) => {
    try {
        const enhancedCacheService = new EnhancedCacheService();
        const result = await enhancedCacheService.invalidateCacheForDocumentUpdate();

        res.json({
            success: true,
            data: result
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to invalidate cache',
            details: error.message
        });
    }
});

/**
 * POST /api/cache/cleanup - Cleanup expired caches and invalid document entries
 */
router.post('/cleanup', async (req: Request, res: Response) => {
    try {
        const enhancedCacheService = new EnhancedCacheService();
        const result = await enhancedCacheService.cleanupExpiredCaches();

        res.json({
            success: true,
            data: {
                message: `Cleaned up ${result.deletedCaches} expired caches and ${result.invalidatedDocumentCaches} invalid document cache entries`,
                deletedCaches: result.deletedCaches,
                invalidatedDocumentCaches: result.invalidatedDocumentCaches
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup caches',
            details: error.message
        });
    }
});

/**
 * DELETE /api/cache/:cacheId - Delete specific cache
 */
router.delete('/:cacheId', async (req: Request, res: Response) => {
    try {
        const { cacheId } = req.params;
        const enhancedCacheService = new EnhancedCacheService();
        
        await enhancedCacheService.deleteCache(cacheId);

        res.json({
            success: true,
            data: {
                message: `Cache ${cacheId} deleted successfully`
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to delete cache',
            details: error.message
        });
    }
});

/**
 * GET /api/cache/validation/:cacheId - Get validation status for specific cache
 */
router.get('/validation/:cacheId', async (req: Request, res: Response) => {
    try {
        const { cacheId } = req.params;
        const enhancedCacheService = new EnhancedCacheService();
        
        // Find cache by ID first
        const caches = await enhancedCacheService.listCaches(1000);
        const cache = caches.find(c => c.id === cacheId);
        
        if (!cache) {
            return res.status(404).json({
                success: false,
                error: 'Cache not found'
            });
        }

        const validationStatus = (cache as any).validationStatus;

        res.json({
            success: true,
            data: {
                cacheId,
                cacheName: cache.name,
                validationStatus
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Failed to get cache validation status',
            details: error.message
        });
    }
});

export default router;
