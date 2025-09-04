import { Express } from 'express';
import { GeminiCachingChatbot } from '../geminiCachingChatbot.js';
import { createChatRoutes } from './chatRoutes.js';
import { createSessionRoutes } from './sessionRoutes.js';
import { createCacheRoutes } from './cacheRoutes.js';
import { createAnalyticsRoutes } from './analyticsRoutes.js';
import { createDatabaseRoutes } from './databaseRoutes.js';
import { createHealthRoutes } from './healthRoutes.js';

export const setupRoutes = (app: Express, chatBot: GeminiCachingChatbot) => {
    // Setup all route groups
    app.use('/api', createChatRoutes(chatBot));
    app.use('/api/sessions', createSessionRoutes(chatBot));
    app.use('/api', createCacheRoutes(chatBot));
    app.use('/api', createAnalyticsRoutes(chatBot));
    app.use('/api/db', createDatabaseRoutes());
    app.use('/', createHealthRoutes());
};
