import { Router } from 'express';
import { GeminiCachingChatbot } from '../geminiCachingChatbot.js';

const router = Router();

export const createSessionRoutes = (chatBot: GeminiCachingChatbot) => {
    // Get all active sessions
    router.get('/', async (req, res) => {
        try {
            const sessions = chatBot.listActiveSessions();
            res.json(sessions);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get specific session info
    router.get('/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const session = await chatBot.getSessionInfo(sessionId);
            
            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }
            
            res.json({
                sessionId: session.sessionId,
                createdAt: session.createdAt,
                lastActivity: session.lastActivity,
                messageCount: session.messageCount
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Delete a session
    router.delete('/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const deleted = chatBot.deleteSession(sessionId);
            
            if (!deleted) {
                return res.status(404).json({ error: 'Session not found' });
            }
            
            res.json({ message: 'Session deleted successfully' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get session messages
    router.get('/:sessionId/messages', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { curated = 'false' } = req.query;
            
            const useCuratedHistory = curated === 'true';
            const messages = await chatBot.getSessionMessages(sessionId, useCuratedHistory);
            
            if (messages === null) {
                return res.status(404).json({ error: 'Session not found' });
            }
            
            res.json({ 
                sessionId,
                messages,
                count: messages.length,
                historyType: useCuratedHistory ? 'curated' : 'comprehensive'
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Cleanup inactive sessions
    router.post('/cleanup', async (req, res) => {
        try {
            const { maxInactiveHours = 24 } = req.body;
            const cleanedCount = chatBot.cleanupInactiveSessions(maxInactiveHours);
            res.json({ 
                message: `Cleaned up ${cleanedCount} inactive sessions`,
                cleanedCount 
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
