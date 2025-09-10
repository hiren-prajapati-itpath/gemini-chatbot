// src/routes/universalSyncRoutes.ts
import { Router, Request, Response } from 'express';
import UniversalSyncService from '../services/UniversalSyncService.js';

const router = Router();
const universalSyncService = new UniversalSyncService();

// Type for content types
type ContentType = 'blogs' | 'solutions' | 'caseStudies' | 'portfolio' | 'careers' | 'testimonials';

/**
 * GET /api/enhanced-sync/status
 * Get current sync status for all content types
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const syncStatus = await universalSyncService.getSyncStatus();

        res.json({
            success: true,
            data: syncStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve sync status'
        });
    }
});

/**
 * GET /api/enhanced-sync/status/:contentType
 * Get sync history for a specific content type
 */
router.get('/status/:contentType', async (req: Request, res: Response) => {
    try {
        const contentType = req.params.contentType as ContentType;
        
        // Validate content type
        const validContentTypes: ContentType[] = ['blogs', 'solutions', 'caseStudies', 'portfolio', 'careers', 'testimonials'];
        if (!validContentTypes.includes(contentType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid content type',
                validTypes: validContentTypes
            });
        }

        const history = await universalSyncService.getContentTypeSyncHistory(contentType);

        res.json({
            success: true,
            data: history,
            contentType,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            message: `Failed to retrieve sync history for ${req.params.contentType}`
        });
    }
});

/**
 * POST /api/enhanced-sync/manual
 * Trigger manual sync with options
 */
router.post('/manual', async (req: Request, res: Response) => {
    try {
        const {
            contentTypes,
            forceFullSync = false,
            skipValidation = false
        } = req.body;

        // Validate content types if provided
        if (contentTypes && Array.isArray(contentTypes)) {
            const validContentTypes: ContentType[] = ['blogs', 'solutions', 'caseStudies', 'portfolio', 'careers', 'testimonials'];
            const invalidTypes = contentTypes.filter(type => !validContentTypes.includes(type));
            
            if (invalidTypes.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid content types provided',
                    invalidTypes,
                    validTypes: validContentTypes
                });
            }
        }

        // Validate document structure if not skipped
        if (!skipValidation) {
            const validation = await universalSyncService.validateDocumentStructure();
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Document structure validation failed',
                    validation
                });
            }
        }

        const report = await universalSyncService.manualSync({
            contentTypes,
            forceFullSync,
            skipValidation
        });

        res.json({
            success: true,
            data: report,
            message: report.overallSuccess ? 'Manual sync completed successfully' : 'Manual sync completed with errors'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Manual sync failed'
        });
    }
});

/**
 * POST /api/enhanced-sync/full
 * Trigger full sync for all content types
 */
router.post('/full', async (req: Request, res: Response) => {
    try {
        const { skipValidation = false } = req.body;

        // Validate document structure if not skipped
        if (!skipValidation) {
            const validation = await universalSyncService.validateDocumentStructure();
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Document structure validation failed',
                    validation
                });
            }
        }

        const report = await universalSyncService.performFullSync();

        res.json({
            success: true,
            data: report,
            message: report.overallSuccess ? 'Full sync completed successfully' : 'Full sync completed with errors'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Full sync failed'
        });
    }
});

/**
 * POST /api/enhanced-sync/force-resync/:contentType
 * Force full resync for a specific content type
 */
router.post('/force-resync/:contentType', async (req: Request, res: Response) => {
    try {
        const contentType = req.params.contentType as ContentType;
        
        // Validate content type
        const validContentTypes: ContentType[] = ['blogs', 'solutions', 'caseStudies', 'portfolio', 'careers', 'testimonials'];
        if (!validContentTypes.includes(contentType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid content type',
                validTypes: validContentTypes
            });
        }

        const result = await universalSyncService.forceFullResync(contentType);

        res.json({
            success: true,
            data: result,
            message: result.success ? `Force resync completed successfully for ${contentType}` : `Force resync failed for ${contentType}`
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            message: `Force resync failed for ${req.params.contentType}`
        });
    }
});
    
/**
 * GET /api/enhanced-sync/validate
 * Validate document structure
 */
router.get('/validate', async (req: Request, res: Response) => {
    try {
        const validation = await universalSyncService.validateDocumentStructure();

        res.json({
            success: true,
            data: validation,
            message: validation.isValid ? 'Document structure is valid' : 'Document structure has issues'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Document validation failed'
        });
    }
});

/**
 * GET /api/enhanced-sync/logs
 * Get enhanced sync logs with filtering
 */
router.get('/logs', async (req: Request, res: Response) => {
    try {
        const {
            limit = 100,
            contentType,
            level = 'all',
            since
        } = req.query;

        const options: any = {
            limit: parseInt(limit as string),
            level: level as string
        };

        if (contentType) {
            const validContentTypes: ContentType[] = ['blogs', 'solutions', 'caseStudies', 'portfolio', 'careers', 'testimonials'];
            if (!validContentTypes.includes(contentType as ContentType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid content type for logs',
                    validTypes: validContentTypes
                });
            }
            options.contentType = contentType;
        }

        if (since) {
            options.since = new Date(since as string);
        }

        const logs = universalSyncService.getEnhancedLogs(options);

        res.json({
            success: true,
            data: logs,
            totalLogs: logs.length,
            filters: options
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve logs'
        });
    }
});

/**
 * POST /api/enhanced-sync/cron/start
 * Start the enhanced cron job
 */
router.post('/cron/start', async (req: Request, res: Response) => {
    try {
        universalSyncService.startEnhancedCronJob();

        res.json({
            success: true,
            message: 'Enhanced cron job started successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to start enhanced cron job'
        });
    }
});

export default router;
