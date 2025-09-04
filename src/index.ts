import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GeminiCachingChatbot } from './geminiCachingChatbot.js';
import { initializeDatabase, closeDatabase } from './config/database.js';
import { setupRoutes } from './routes/index.js';
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

// Setup all routes
setupRoutes(app, chatBot);

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

const PORT = parseInt(process.env.PORT || '3000');

// Initialize database and start server
const startServer = async () => {
    try {
        // Initialize database first
        await initializeDatabase();
        
        // Start the server
        app.listen(PORT, "0.0.0.0", () => {
            console.log('🚀 Gemini Context Caching Chatbot Server');
            console.log(`📡 Server running on http://localhost:${PORT}`);
            console.log('🤖 Using Gemini 2.5 Flash with explicit caching');
            console.log('📚 Documentation: https://ai.google.dev/gemini-api/docs/caching');
            console.log('🗂️  Routes organized in separate modules');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

export default app;
