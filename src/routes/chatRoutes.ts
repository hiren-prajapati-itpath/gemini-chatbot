import { Router } from 'express';
import { GeminiCachingChatbot } from '../geminiCachingChatbot.js';

const router = Router();

export const createChatRoutes = (chatBot: GeminiCachingChatbot) => {
    // Start a new chat session
    router.post('/start-chat', async (req, res) => {
        try {
            const { sessionId, initialMessage } = req.body;
            const result = await chatBot.startChat(sessionId, initialMessage);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Continue an existing chat session
    router.post('/chat/:sessionId/continue', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { message } = req.body;
            
            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }
            
            const result = await chatBot.continueChat(sessionId, message);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Ask a standalone question (not part of a session)
    router.post('/ask', async (req, res) => {
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

    return router;
};
