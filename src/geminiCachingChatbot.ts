import { GoogleGenAI, createUserContent, createPartFromUri, createPartFromText } from '@google/genai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CacheService } from './services/CacheService.js';
import { initializeDatabase } from './config/database.js';
import { Response } from 'express';
import { SessionStorageService } from './services/storage/SessionStorageService.js';
import { TokenAccountingService, TokenUsage } from './services/TokenAccountingService.js';
import { SessionContext } from './models/SessionContext.js';
import { ConversationMessage } from './models/ConversationMessage.js';
import { StorageFactory } from './config/storage.js';

export class GeminiCachingChatbot {
    private ai: GoogleGenAI;
    private cache: any = null;
    private chatHistory: Array<any> = [];
    private cacheService!: CacheService;
    private sessionStorage!: SessionStorageService;
    private tokenAccounting: TokenAccountingService;
    private modelName = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-001';

    // Keep backward compatibility for existing code
    private CACHE_TTL = process.env.CACHE_TTL ?? '28800s'; // 8 hours in seconds

    constructor(apiKey: string, storageService?: SessionStorageService) {
        console.log('Initializing Gemini Caching Chatbot with API Key:', apiKey);
        this.ai = new GoogleGenAI({ apiKey });
        this.tokenAccounting = new TokenAccountingService();
        this.initializeServices(storageService);
    }

    private async initializeServices(storageService?: SessionStorageService) {
        try {
            // Initialize database and cache service
            const db = await initializeDatabase();
            if (db) {
                this.cacheService = new CacheService();
                await this.loadActiveCache();
                console.log('✅ Cache service initialized');
            } else {
                console.log('⚠️  Cache service disabled - running without database persistence');
            }

            // Initialize session storage
            if (storageService) {
                this.sessionStorage = storageService;
                console.log('✅ Session storage service provided');
            } else {
                this.sessionStorage = await StorageFactory.createStorageService();
                console.log('✅ Session storage service initialized');
            }
        } catch (error) {
            console.error('❌ Failed to initialize services:', error);
            console.log('⚠️  Continuing with fallback services');
            // Fallback to in-memory storage if all else fails
            if (!this.sessionStorage) {
                const { InMemorySessionStorage } = await import('./services/storage/InMemorySessionStorage.js');
                this.sessionStorage = new InMemorySessionStorage();
            }
        }
    }

    private async loadActiveCache() {
        try {
            if (!this.cacheService) {
                console.log('📝 Cache service not available, skipping cache restoration');
                return;
            }

            const activeCache = await this.cacheService.getActiveCache();
            if (activeCache) {
                // Try to find the cache in Gemini API
                const geminiCache = await this.findCacheByName(activeCache.name);
                if (geminiCache) {
                    this.cache = geminiCache;
                    // Initialize token accounting with cache tokens
                    const cacheTokens = activeCache.cachedTokens;
                    this.tokenAccounting = new TokenAccountingService(cacheTokens);
                    console.log(`🔄 Restored cache: ${activeCache.name}`);
                } else if (activeCache.fileUri) {
                    // Cache expired/deleted, recreate from file
                    console.log(`♻️ Recreating expired cache from file...`);
                    await this.recreateCacheFromRecord(activeCache);
                }
            }
        } catch (error) {
            console.warn('Failed to load active cache:', error);
        }
    }

    private async findCacheByName(name: string) {
        const pager = await this.ai.caches.list({ config: { pageSize: 50 } });
        let page = pager.page;
        while (true) {
            const found = page.find((c: any) => c.name === name);
            if (found) return found;
            if (!pager.hasNextPage()) break;
            page = await pager.nextPage();
        }
        return null;
    }

    private async recreateCacheFromRecord(record: any) {
        try {
            const cacheConfig = {
                model: record.model,
                config: {
                    contents: [createUserContent([createPartFromUri(record.fileUri, record.mimeType)])],
                    systemInstruction: record.systemInstruction,
                    ttl: this.CACHE_TTL
                }
            };

            this.cache = await this.ai.caches.create(cacheConfig);
            const cacheTokens = this.cache.usageMetadata?.totalTokenCount || 0;
            this.tokenAccounting = new TokenAccountingService(cacheTokens);

            // Update DB record
            await this.cacheService.updateCache(record.id, {
                name: this.cache.name,
                expireTime: this.cache.expireTime ? new Date(this.cache.expireTime) : undefined,
                cachedTokens: cacheTokens
            });

            console.log(`✅ Cache recreated: ${this.cache.name}`);
        } catch (error) {
            console.error('Failed to recreate cache:', error);
        }
    }

    private async getSystemInstruction(): Promise<string> {
        const defaultPath = path.join(process.cwd(), 'system-instruction.txt');
        try {
            console.log(`Loading system instruction from default file: ${defaultPath}`);
            return await fs.readFile(defaultPath, 'utf-8');
        } catch (error) {
            console.warn(`⚠️ Warning: Could not read default system instruction file: "${defaultPath}". Using fallback instruction.`);
            return "You are Gemini, a helpful assistant. Please answer questions based on the provided company profile.";
        }
    }

    async createCompanyCache(fileUri: string, mimeType: string) {
        const systemInstruction = await this.getSystemInstruction();

        const doc = await this.ai.files.upload({
            file: fileUri,
            config: { mimeType },
        });
        console.log("Uploaded file name:", doc.name);

        const cacheConfig = {
            model: this.modelName,
            config: {
                contents: [createUserContent([createPartFromUri(doc.uri ?? '', doc.mimeType ?? '')])],
                systemInstruction: systemInstruction,
                ttl: this.CACHE_TTL
            }
        };

        this.cache = await this.ai.caches.create(cacheConfig);
        const cacheTokens = this.cache.usageMetadata?.totalTokenCount || 0;
        this.tokenAccounting = new TokenAccountingService(cacheTokens);

        // Save to database
        await this.cacheService.saveCache({
            name: this.cache.name,
            model: this.modelName,
            fileUri: doc.uri,
            mimeType: doc.mimeType,
            systemInstruction: systemInstruction,
            expireTime: this.cache.expireTime ? new Date(this.cache.expireTime) : undefined,
            cachedTokens: cacheTokens,
            uploadedFileName: doc.name
        });

        // Log cache creation and storage cost
        const costBreakdown = this.tokenAccounting.getCostBreakdown();
        console.log('[Cache Created]');
        console.log(`- Name: ${this.cache.name}`);
        console.log(`- Cached tokens: ${cacheTokens}`);
        console.log(`- One-time create cost: $${costBreakdown.cacheCreationCost.oneTimeCostUSD}`);
        console.log(`- Storage per hour: $${costBreakdown.cachingStorageCost.costPerHourUSD}`);
        if (this.cache.expireTime) console.log(`- Expires: ${this.cache.expireTime}`);

        return {
            success: true,
            cacheName: this.cache.name,
            cachedTokens: cacheTokens,
            expiresAt: this.cache.expireTime,
            message: 'Company profile has been cached successfully using explicit caching.'
        };
    }

    async askQuestion(
        userQuestion: string,
        useStreaming = false,
        maxTokens?: number,
        res?: Response
    ) {
        // Auto-initialize cache if not available
        if (!this.cache) {
            await this.loadActiveCache();
            if (!this.cache) {
                throw new Error('No cache available. Please create a company cache first.');
            }
        }
        console.log("Using cache:", this.cache.name);

        // Auto-detect if this is a list request and increase token limit
        const isListRequest = /\b(recent|all|list|latest|blog posts?|case studies|portfolio|testimonials|awards|careers?|openings?)\b/i.test(userQuestion);
        const outputTokenLimit = maxTokens || (isListRequest ? 1000 : 500);

        const generateConfig = {
            model: this.modelName,
            contents: userQuestion,
            config: {
                cachedContent: this.cache.name,
                temperature: 0.7,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: outputTokenLimit,
                thinkingConfig: { thinkingBudget: 0 }
            }
        };

        let response: any;
        let fullResponse = '';

        if (useStreaming) {
            if (!res) {
                throw new Error('Response object is required for streaming');
            }

            const stream = await this.ai.models.generateContentStream(generateConfig);
            for await (const chunk of stream) {
                const chunkText = chunk.text || '';
                if (chunkText) {
                    fullResponse += chunkText;
                    res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
                    console.log("[stream-chunk]", chunkText.substring(0, 100) + "...");
                }
            }

            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();

            response = {
                text: fullResponse
            };
        } else {
            response = await this.ai.models.generateContent(generateConfig);
            fullResponse = response.text;
        }

        this.chatHistory.push({ role: 'user', content: userQuestion, timestamp: new Date() });
        this.chatHistory.push({ role: 'assistant', content: fullResponse, timestamp: new Date() });

        const usageData = response.usageMetadata || {};
        const promptTokens = usageData.promptTokenCount || this.estimateTokens(userQuestion);
        const responseTokens = usageData.candidatesTokenCount || this.estimateTokens(fullResponse);
        const cachedTokens = usageData.cachedContentTokenCount || 0;
        const billedInputTokens = Math.max(0, (usageData.promptTokenCount ?? promptTokens) - (usageData.cachedContentTokenCount ?? 0));
        const isEstimated = !response.usageMetadata; // stream mode

        // Update token accounting using the service
        const tokenUsage: TokenUsage = {
            promptTokens,
            responseTokens,
            cachedTokens,
            billedInputTokens,
            totalTokens: promptTokens + responseTokens,
            estimated: isEstimated
        };

        this.tokenAccounting.updateTokenStats(
            userQuestion,
            tokenUsage,
            useStreaming ? 'stream' : 'standard'
        );

        return {
            response: fullResponse,
            tokenUsage: {
                promptTokens,
                responseTokens,
                cachedTokens,
                billedInputTokens,
                totalTokens: promptTokens + responseTokens,
                estimated: isEstimated
            },
            cacheHit: cachedTokens > 0,
            usageMetadata: usageData
        };
    }

    private generateSessionId(): string {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async startChat(
        sessionId?: string, 
        initialMessage?: string, 
        useStreaming = false,
        maxTokens?: number,
        res?: Response
    ) {
        if (!this.cache) throw new Error('No cache available. Please create a company cache first.');

        const finalSessionId = sessionId || this.generateSessionId();

        // Check if session already exists
        const existingSession = await this.sessionStorage.getSession(finalSessionId);
        if (existingSession) {
            throw new Error(`Session ${finalSessionId} already exists. Use continueChat to continue the conversation.`);
        }

        // Auto-detect if this is a list request and increase token limit
        const isListRequest = initialMessage && /\b(recent|all|list|latest|blog posts?|case studies|portfolio|testimonials|awards|careers?|openings?)\b/i.test(initialMessage);
        const outputTokenLimit = maxTokens || (isListRequest ? 1000 : 500);

        const chat = this.ai.chats.create({
            model: this.modelName,
            config: {
                cachedContent: this.cache.name,
                temperature: 0.7,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: outputTokenLimit,
                thinkingConfig: { thinkingBudget: 0 }
            },
            history: []
        });

        const sessionContext: SessionContext = {
            sessionId: finalSessionId,
            geminiChat: null, // We don't store chat objects, only rebuild from Redis history
            createdAt: new Date(),
            lastActivity: new Date(),
            messageCount: 0
        };

        // Save session metadata to Redis (no geminiChat object stored)
        await this.sessionStorage.saveSession(sessionContext);
        console.log(`📝 Created new chat session: ${finalSessionId}`);

        if (initialMessage) {
            let response: any;
            let responseText = '';

            if (useStreaming) {
                if (!res) {
                    throw new Error('Response object is required for streaming');
                }

                const stream = await chat.sendMessageStream({ message: initialMessage });
                for await (const chunk of stream) {
                    const chunkText = chunk.text || '';
                    if (chunkText) {
                        responseText += chunkText;
                        res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
                        console.log("[stream-chunk]", chunkText.substring(0, 100) + "...");
                    }
                }

                // Include session metadata in the final streaming response
                res.write(`data: ${JSON.stringify({ 
                    done: true, 
                    sessionId: finalSessionId,
                    messageCount: 2
                })}\n\n`);
                res.end();

                response = {
                    text: responseText,
                    usageMetadata: null // Streaming doesn't provide metadata immediately
                };
            } else {
                response = await chat.sendMessage({ message: initialMessage });
                responseText = response.text || '';
            }
            
            sessionContext.messageCount = 2;
            sessionContext.lastActivity = new Date();
            await this.sessionStorage.saveSession(sessionContext);

            // Save messages to Redis
            await this.sessionStorage.saveMessage({
                sessionId: finalSessionId,
                role: 'user',
                content: initialMessage,
                timestamp: new Date(),
                messageIndex: 1
            });

            await this.sessionStorage.saveMessage({
                sessionId: finalSessionId,
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
                messageIndex: 2
            });

            // Track tokens using the service
            const usageData = response.usageMetadata || {};
            const promptTokens = usageData.promptTokenCount || this.estimateTokens(initialMessage);
            const responseTokens = usageData.candidatesTokenCount || this.estimateTokens(responseText);
            const cachedTokens = usageData.cachedContentTokenCount || 0;
            const billedInputTokens = Math.max(0, promptTokens - cachedTokens);

            const tokenUsage: TokenUsage = {
                promptTokens,
                responseTokens,
                cachedTokens,
                billedInputTokens,
                totalTokens: promptTokens + responseTokens,
                estimated: !response.usageMetadata
            };

            this.tokenAccounting.updateTokenStats(initialMessage, tokenUsage, useStreaming ? 'stream' : 'chat', finalSessionId);

            console.log(`💬 Session ${finalSessionId}: Initial exchange completed`);
            return {
                sessionId: finalSessionId,
                response: responseText,
                messageCount: sessionContext.messageCount,
                tokenUsage: response.usageMetadata || null,
                cacheHit: cachedTokens > 0,
                usageMetadata: usageData
            };
        }

        return {
            sessionId: finalSessionId,
            response: null,
            messageCount: 0
        };
    }

    async continueChat(
        sessionId: string, 
        message: string,
        useStreaming = false,
        maxTokens?: number,
        res?: Response
    ): Promise<{
        response: string;
        sessionId: string;
        messageCount: number;
        tokenUsage?: any;
        cacheHit?: boolean;
        usageMetadata?: any;
    }> {
        const session = await this.sessionStorage.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found. Please start a new chat session.`);
        }

        try {
            // Always rebuild Gemini chat object from Redis message history
            const previousMessages = await this.sessionStorage.getSessionMessages(sessionId);
            
            // Convert stored messages to Gemini history format
            const history = previousMessages?.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })) || [];

            // Auto-detect if this is a list request and increase token limit
            const isListRequest = /\b(recent|all|list|latest|blog posts?|case studies|portfolio|testimonials|awards|careers?|openings?)\b/i.test(message);
            const outputTokenLimit = maxTokens || (isListRequest ? 1000 : 500);

            // Create fresh chat object with full conversation context
            const geminiChat = this.ai.chats.create({
                model: this.modelName,
                config: {
                    cachedContent: this.cache.name,
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: outputTokenLimit,
                    thinkingConfig: { thinkingBudget: 0 }
                },
                history: history // ✅ Full context from Redis message history
            });

            console.log(`🔄 Built chat object with ${history.length} previous messages for session ${sessionId}`);

            let response: any;
            let responseText = '';

            if (useStreaming) {
                if (!res) {
                    throw new Error('Response object is required for streaming');
                }

                const stream = await geminiChat.sendMessageStream({ message });
                for await (const chunk of stream) {
                    const chunkText = chunk.text || '';
                    if (chunkText) {
                        responseText += chunkText;
                        res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
                        console.log("[stream-chunk]", chunkText.substring(0, 100) + "...");
                    }
                }

                // Include session metadata in the final streaming response
                res.write(`data: ${JSON.stringify({ 
                    done: true, 
                    sessionId: sessionId,
                    messageCount: session.messageCount + 2
                })}\n\n`);
                res.end();

                response = {
                    text: responseText,
                    usageMetadata: null // Streaming doesn't provide metadata immediately
                };
            } else {
                // Send message to the chat object (with complete context)
                response = await geminiChat.sendMessage({ message });
                responseText = response.text || '';
            }

            // Update session metadata
            session.messageCount += 2;
            session.lastActivity = new Date();
            await this.sessionStorage.saveSession(session);

            // Save user message to Redis
            await this.sessionStorage.saveMessage({
                sessionId,
                role: 'user',
                content: message,
                timestamp: new Date(),
                messageIndex: session.messageCount - 1
            });

            // Save assistant response to Redis
            await this.sessionStorage.saveMessage({
                sessionId,
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
                messageIndex: session.messageCount
            });

            // Track tokens using the service
            const usageData = response.usageMetadata || {};
            const promptTokens = usageData.promptTokenCount || this.estimateTokens(message);
            const responseTokens = usageData.candidatesTokenCount || this.estimateTokens(responseText);
            const cachedTokens = usageData.cachedContentTokenCount || 0;
            const billedInputTokens = Math.max(0, promptTokens - cachedTokens);

            const tokenUsage: TokenUsage = {
                promptTokens,
                responseTokens,
                cachedTokens,
                billedInputTokens,
                totalTokens: promptTokens + responseTokens,
                estimated: !response.usageMetadata
            };

            this.tokenAccounting.updateTokenStats(message, tokenUsage, useStreaming ? 'stream' : 'chat', sessionId);

            console.log(`💬 Session ${sessionId}: Continued conversation (${session.messageCount} total messages)`);

            return {
                response: responseText,
                sessionId: sessionId,
                messageCount: session.messageCount,
                tokenUsage: response.usageMetadata || null,
                cacheHit: cachedTokens > 0,
                usageMetadata: usageData
            };
        } catch (error) {
            console.error(`❌ Error in session ${sessionId}:`, error);
            throw error;
        }
    }

    async getSessionMessages(sessionId: string, useCuratedHistory: boolean = false): Promise<any[] | null> {
        return await this.sessionStorage.getSessionMessages(sessionId);
    }

    async getSessionInfo(sessionId: string): Promise<SessionContext | null> {
        return await this.sessionStorage.getSession(sessionId);
    }

    async listActiveSessions(): Promise<{ sessionId: string; createdAt: Date; lastActivity: Date; messageCount: number }[]> {
        const sessions = await this.sessionStorage.listActiveSessions();
        return sessions.map(session => ({
            sessionId: session.sessionId,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            messageCount: session.messageCount
        }));
    }

    async deleteSession(sessionId: string): Promise<boolean> {
        const deleted = await this.sessionStorage.deleteSession(sessionId);
        if (deleted) {
            console.log(`🗑️ Deleted session: ${sessionId}`);
        }
        return deleted;
    }

    async cleanupInactiveSessions(maxInactiveHours: number = 24): Promise<number> {
        const cleanedCount = await this.sessionStorage.cleanupInactiveSessions(maxInactiveHours);
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} inactive sessions`);
        }
        return cleanedCount;
    }

    async listCaches() {
        const pager = await this.ai.caches.list({ config: { pageSize: 10 } });
        let page = pager.page;
        const caches: any[] = [];
        while (true) {
            for (const cache of page) {
                caches.push(cache);
            }
            if (!pager.hasNextPage()) break;
            page = await pager.nextPage();
        }
        return caches;
    }

    async updateCacheTTL(newTTL = '7200s') {
        if (!this.cache) throw new Error('No cache to update');
        const updatedCache = await this.ai.caches.update({
            name: this.cache.name,
            config: { ttl: newTTL }
        });
        this.cache = updatedCache;
        return updatedCache;
    }

    async deleteCache() {
        if (!this.cache) throw new Error('No cache to delete');

        await this.ai.caches.delete({ name: this.cache.name });

        const activeCache = await this.cacheService.getActiveCache();
        if (activeCache) {
            await this.cacheService.deleteCache(activeCache.id);
        }

        this.cache = null;
        return true;
    }

    estimateTokens(text: string) {
        return Math.ceil(text.length / 4);
    }

    // Public getters for services
    getTokenAccounting(): TokenAccountingService {
        return this.tokenAccounting;
    }
}