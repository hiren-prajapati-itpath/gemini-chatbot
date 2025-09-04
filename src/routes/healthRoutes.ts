import { Router } from 'express';

const router = Router();

export const createHealthRoutes = () => {
    // Health check endpoint
    router.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            geminiModel: 'gemini-2.5-flash'
        });
    });

    return router;
};
