import { Router } from 'express';
import { GeminiCachingChatbot } from '../geminiCachingChatbot.js';

const router = Router();

export const createAnalyticsRoutes = (chatBot: GeminiCachingChatbot) => {
    // Get token analysis and cost savings
    router.get('/token-analysis', (req, res) => {
        try {
            const analysis = chatBot.getTokenAccounting().calculateCostSavings();
            res.json(analysis);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get detailed token analytics with per-question breakdown
    router.get('/token-analysis/detailed', (req, res) => {
        try {
            const limit = req.query.limit ? Number(req.query.limit) : 100;
            const tokenService = chatBot.getTokenAccounting();
            const summary = tokenService.calculateCostSavings();
            const detailed = tokenService.getTokenAnalyticsDetailed(limit);
            res.json({ summary, detailed });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get conversation history (placeholder - needs implementation)
    router.get('/history', (req, res) => {
        try {
            // This would need to be implemented in the chatbot or session storage
            res.json({ 
                message: 'History endpoint needs implementation',
                note: 'Use sessions endpoints for per-session history'
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Reset conversation (placeholder - needs implementation)
    router.post('/reset', (req, res) => {
        try {
            // This would need to be implemented - perhaps clear all sessions
            res.json({ 
                message: 'Reset endpoint needs implementation',
                note: 'Use session cleanup endpoint for similar functionality'
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
