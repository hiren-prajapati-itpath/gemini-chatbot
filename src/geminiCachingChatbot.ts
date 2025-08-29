import { GoogleGenAI, createUserContent, createPartFromUri, createPartFromText } from '@google/genai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CacheService } from './services/CacheService.js';
import { initializeDatabase } from './config/database.js';
import { Response } from 'express';

export class GeminiCachingChatbot {
    private ai: GoogleGenAI;
    private cache: any = null;
    private chatHistory: Array<any> = [];
    private cacheService!: CacheService;
    private tokenUsageStats = {
        cacheTokens: 0,
        conversationTokens: 0,
        totalRequests: 0,
        cacheHits: 0
    };
    // Pricing (USD per 1M tokens). Can be overridden using env vars.
    private PRICING = {
        INPUT_PER_MTOK: Number(process.env.GEM_INPUT_PER_MTOK ?? 0.10),
        OUTPUT_PER_MTOK: Number(process.env.GEM_OUTPUT_PER_MTOK ?? 0.40),
        CACHE_CREATE_PER_MTOK: Number(process.env.GEM_CACHE_CREATE_PER_MTOK ?? 0.025),
        CACHE_STORAGE_PER_MTOK_PER_HR: Number(process.env.GEM_CACHE_STORAGE_PER_MTOK_PER_HR ?? 1.0)
    };
    // Cache TTL configuration (8 hours default)
    private CACHE_TTL = process.env.CACHE_TTL ?? '28800s'; // 8 hours in seconds
    // Fine-grained token tracking
    private tokenBreakdown = {
        totalPromptTokens: 0,
        totalResponseTokens: 0,
        totalBilledInputTokens: 0,
        perQuestion: [] as Array<{
            question: string;
            promptTokens: number;
            responseTokens: number;
            cachedTokens: number;
            billedInputTokens: number;
            totalTokens: number;
            timestamp: string;
            mode: 'standard' | 'ultra' | 'stream';
            estimated?: boolean;
        }>
    };
    private modelName = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-001';

    constructor(apiKey: string) {
        console.log('Initializing Gemini Caching Chatbot with API Key:', apiKey);
        this.ai = new GoogleGenAI({ apiKey });
        this.initializeServices();
    }

    private async initializeServices() {
        try {
            const db = await initializeDatabase();
            if (db) {
                this.cacheService = new CacheService();
                await this.loadActiveCache();
                console.log('✅ Cache service initialized');
            } else {
                console.log('⚠️  Cache service disabled - running without database persistence');
            }
        } catch (error) {
            console.error('❌ Failed to initialize cache service:', error);
            console.log('⚠️  Continuing without database persistence');
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
                    this.tokenUsageStats.cacheTokens = activeCache.cachedTokens;
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
            this.tokenUsageStats.cacheTokens = this.cache.usageMetadata?.totalTokenCount || 0;
            
            // Update DB record
            await this.cacheService.updateCache(record.id, {
                name: this.cache.name,
                expireTime: this.cache.expireTime ? new Date(this.cache.expireTime) : undefined,
                cachedTokens: this.tokenUsageStats.cacheTokens
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
        this.tokenUsageStats.cacheTokens = this.cache.usageMetadata?.totalTokenCount || 0;

        // Save to database
        await this.cacheService.saveCache({
            name: this.cache.name,
            model: this.modelName,
            fileUri: doc.uri,
            mimeType: doc.mimeType,
            systemInstruction: systemInstruction,
            expireTime: this.cache.expireTime ? new Date(this.cache.expireTime) : undefined,
            cachedTokens: this.tokenUsageStats.cacheTokens,
            uploadedFileName: doc.name
        });

        // Log cache creation and storage cost
        const cacheTokens = this.tokenUsageStats.cacheTokens;
        const createCost = this.cost(cacheTokens, this.PRICING.CACHE_CREATE_PER_MTOK);
        const storagePerHour = this.cost(cacheTokens, this.PRICING.CACHE_STORAGE_PER_MTOK_PER_HR);
        console.log('[Cache Created]');
        console.log(`- Name: ${this.cache.name}`);
        console.log(`- Cached tokens: ${cacheTokens}`);
        console.log(`- One-time create cost: $${createCost.toFixed(5)} @ $${this.PRICING.CACHE_CREATE_PER_MTOK}/1M`);
        console.log(`- Storage per hour: $${storagePerHour.toFixed(5)} @ $${this.PRICING.CACHE_STORAGE_PER_MTOK_PER_HR}/1M`);
        if (this.cache.expireTime) console.log(`- Expires: ${this.cache.expireTime}`);

        return {
            success: true,
            cacheName: this.cache.name,
            cachedTokens: this.tokenUsageStats.cacheTokens,
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
                    // Append the streamed chunk to the full response
                    fullResponse += chunkText;
                    // Send chunk directly to client
                    res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
                    console.log("[stream-chunk]", chunkText.substring(0, 100) + "...");
                }
            }
            
            // End the stream
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
            
            response = {
                text: fullResponse
                // usageMetadata not available in stream mode
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
        this.tokenUsageStats.conversationTokens += promptTokens + responseTokens;
        this.tokenBreakdown.totalPromptTokens += promptTokens;
        this.tokenBreakdown.totalResponseTokens += responseTokens;
        this.tokenBreakdown.totalBilledInputTokens += billedInputTokens;
        this.tokenBreakdown.perQuestion.push({
            question: userQuestion,
            promptTokens,
            responseTokens,
            cachedTokens,
            billedInputTokens,
            totalTokens: promptTokens + responseTokens,
            timestamp: new Date().toISOString(),
            mode: useStreaming ? 'stream' : 'standard',
            estimated: isEstimated
        });
    this.tokenUsageStats.totalRequests++;
    if (cachedTokens > 0) this.tokenUsageStats.cacheHits++;

    // Detailed per-question billing log
    const inputCost = this.cost(billedInputTokens, this.PRICING.INPUT_PER_MTOK);
    const outputCost = this.cost(responseTokens, this.PRICING.OUTPUT_PER_MTOK);
    const storagePerHour = this.cost(this.tokenUsageStats.cacheTokens, this.PRICING.CACHE_STORAGE_PER_MTOK_PER_HR);
    const tag = isEstimated ? '[Token Usage - Estimated]' : '[Token Usage]';
    console.log(tag);
    console.log(`Q#${this.tokenUsageStats.totalRequests}: ${userQuestion}`);
    console.log(`- promptTokens (includes cache): ${promptTokens}`);
    console.log(`- cachedTokens (reused, not billed on input): ${cachedTokens}${isEstimated ? ' (n/a in stream)' : ''}`);
    console.log(`- new input tokens billed: ${billedInputTokens}${isEstimated ? ' (estimated)' : ''}`);
    console.log(`- output tokens billed: ${responseTokens}${isEstimated ? ' (estimated)' : ''}`);
    console.log(`- est. input cost: $${inputCost.toFixed(6)} | est. output cost: $${outputCost.toFixed(6)}`);
    console.log(`- cache storage (per hour): $${storagePerHour.toFixed(5)} for ${this.tokenUsageStats.cacheTokens} tokens`);
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

    async startChat(initialMessage?: string) {
        if (!this.cache) throw new Error('No cache available. Please create a company cache first.');
        const chat = this.ai.chats.create({
            model: this.modelName,
            config: {
                cachedContent: this.cache.name,
                temperature: 0.7
            },
            history: []
        });
        if (initialMessage) {
            const response = await chat.sendMessage({ message: initialMessage });
            return { chat, initialResponse: response.text };
        }
        return { chat, initialResponse: null };
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
        
        // Delete from Gemini API
        await this.ai.caches.delete({ name: this.cache.name });
        
        // Remove from database
        const activeCache = await this.cacheService.getActiveCache();
        if (activeCache) {
            await this.cacheService.deleteCache(activeCache.id);
        }
        
        this.cache = null;
        return true;
    }

    calculateCostSavings() {
        // Prefer chat history when available; otherwise fall back to requests processed
        const totalRequests = this.tokenUsageStats.totalRequests;
        const conversationRounds = this.chatHistory.length > 0
            ? Math.floor(this.chatHistory.length / 2)
            : totalRequests;

        const cacheTokens = this.tokenUsageStats.cacheTokens;
        const totalNewInputTokens = this.tokenBreakdown.totalBilledInputTokens; // Only the new tokens are billed on input with caching

        // Hypothetical scenario WITHOUT caching: each request would include the full cache tokens + the new input tokens
        const inputTokensWithoutCaching = totalNewInputTokens + (cacheTokens * totalRequests);
        const inputTokensWithCaching = totalNewInputTokens;
        const inputTokensSaved = Math.max(0, inputTokensWithoutCaching - inputTokensWithCaching); // == cacheTokens * totalRequests

        // Costs (input side only). Output costs are identical in both scenarios.
        const inputCostWithoutCachingUSD = this.cost(inputTokensWithoutCaching, this.PRICING.INPUT_PER_MTOK);
        const inputCostWithCachingUSD = this.cost(inputTokensWithCaching, this.PRICING.INPUT_PER_MTOK);
        const inputCostSavedUSD = inputCostWithoutCachingUSD - inputCostWithCachingUSD;

        // Cache one-time and storage costs
        const cacheCreateCostUSD = this.cost(cacheTokens, this.PRICING.CACHE_CREATE_PER_MTOK);
        const cacheStoragePerHourUSD = this.cost(cacheTokens, this.PRICING.CACHE_STORAGE_PER_MTOK_PER_HR);

        // Human-friendly means
        const meanPromptTokens = totalRequests > 0 ? Number((this.tokenBreakdown.totalPromptTokens / totalRequests).toFixed(1)) : 0;
        const meanBilledInputTokens = totalRequests > 0 ? Number((this.tokenBreakdown.totalBilledInputTokens / totalRequests).toFixed(1)) : 0;
        const meanResponseTokens = totalRequests > 0 ? Number((this.tokenBreakdown.totalResponseTokens / totalRequests).toFixed(1)) : 0;
        const meanTotalTokens = totalRequests > 0 ? Number(((this.tokenBreakdown.totalPromptTokens + this.tokenBreakdown.totalResponseTokens) / totalRequests).toFixed(1)) : 0;

        return {
            overview: {
                cacheTokens,
                conversationTokens: this.tokenUsageStats.conversationTokens,
                totalRequests,
                cacheHits: this.tokenUsageStats.cacheHits,
                cacheHitRate: totalRequests > 0 ? Number(((this.tokenUsageStats.cacheHits / totalRequests) * 100).toFixed(1)) : 0,
                conversationRounds
            },
            inputComparison: {
                withCaching: {
                    tokens: inputTokensWithCaching,
                    costUSD: Number(inputCostWithCachingUSD.toFixed(6))
                },
                withoutCaching: {
                    tokens: inputTokensWithoutCaching,
                    costUSD: Number(inputCostWithoutCachingUSD.toFixed(6))
                },
                saved: {
                    tokens: inputTokensSaved,
                    costUSD: Number(inputCostSavedUSD.toFixed(6)),
                    percent: inputTokensWithoutCaching > 0 ? Number(((inputTokensSaved / inputTokensWithoutCaching) * 100).toFixed(2)) : 0
                }
            },
            cacheCosts: {
                createOnceUSD: Number(cacheCreateCostUSD.toFixed(6)),
                storagePerHourUSD: Number(cacheStoragePerHourUSD.toFixed(6)),
                expiresAt: this.cache?.expireTime ?? null
            },
            meansPerQuestion: {
                // Note: meanPromptTokens includes cached tokens; meanBilledInputTokens are the new, actually billed input tokens
                promptTokens: meanPromptTokens,
                billedInputTokens: meanBilledInputTokens,
                responseTokens: meanResponseTokens,
                totalTokens: meanTotalTokens
            }
        };
    }

    // Detailed analytics including per-question breakdown
    getTokenAnalyticsDetailed(limit = 100) {
        const total = this.tokenUsageStats.totalRequests || 1;
        const perQuestion = this.tokenBreakdown.perQuestion.slice(-limit);
        return {
            totals: {
                requests: this.tokenUsageStats.totalRequests,
                promptTokens: this.tokenBreakdown.totalPromptTokens,
                billedInputTokens: this.tokenBreakdown.totalBilledInputTokens,
                responseTokens: this.tokenBreakdown.totalResponseTokens,
                totalTokens: this.tokenBreakdown.totalPromptTokens + this.tokenBreakdown.totalResponseTokens
            },
            means: {
                perQuestion: Number(((this.tokenBreakdown.totalPromptTokens + this.tokenBreakdown.totalResponseTokens) / total).toFixed(1)),
                // input shows promptTokens (includes cache); inputBilled shows only new tokens actually billed
                input: Number((this.tokenBreakdown.totalPromptTokens / total).toFixed(1)),
                inputBilled: Number((this.tokenBreakdown.totalBilledInputTokens / total).toFixed(1)),
                output: Number((this.tokenBreakdown.totalResponseTokens / total).toFixed(1))
            },
            perQuestion
        };
    }

    // Human-friendly cost summary matching the plain-English explanation
    getCostBreakdown() {
        const total = this.tokenUsageStats.totalRequests || 0;
        const cacheTokens = this.tokenUsageStats.cacheTokens;
        const avgNewInputTokens = total > 0 ? this.tokenBreakdown.totalBilledInputTokens / total : 0;
        const avgOutputTokens = total > 0 ? this.tokenBreakdown.totalResponseTokens / total : 0;

        const storagePerHourUSD = this.cost(cacheTokens, this.PRICING.CACHE_STORAGE_PER_MTOK_PER_HR);
        const cacheCreateUSD = this.cost(cacheTokens, this.PRICING.CACHE_CREATE_PER_MTOK);
        const inputCostPerQuestionUSD = this.cost(avgNewInputTokens, this.PRICING.INPUT_PER_MTOK);
        const outputCostPerAnswerUSD = this.cost(avgOutputTokens, this.PRICING.OUTPUT_PER_MTOK);

        return {
            cachingStorageCost: {
                cacheTokens,
                pricePerMTokPerHourUSD: this.PRICING.CACHE_STORAGE_PER_MTOK_PER_HR,
                costPerHourUSD: Number(storagePerHourUSD.toFixed(6))
            },
            cacheCreationCost: {
                cacheTokens,
                pricePerMTokUSD: this.PRICING.CACHE_CREATE_PER_MTOK,
                oneTimeCostUSD: Number(cacheCreateUSD.toFixed(6))
            },
            inputCostPerAverageQuestion: {
                avgNewInputTokens: Number(avgNewInputTokens.toFixed(1)),
                pricePerMTokUSD: this.PRICING.INPUT_PER_MTOK,
                costUSD: Number(inputCostPerQuestionUSD.toFixed(7))
            },
            outputCostPerAverageAnswer: {
                avgOutputTokens: Number(avgOutputTokens.toFixed(1)),
                pricePerMTokUSD: this.PRICING.OUTPUT_PER_MTOK,
                costUSD: Number(outputCostPerAnswerUSD.toFixed(6))
            },
            notes: {
                promptTokensExplain: 'promptTokens includes cached + new tokens; only the new (billedInputTokens) are charged for input.',
                effectiveness: 'Caching shifts most input cost away; storage is a small flat hourly fee.'
            }
        };
    }

    estimateTokens(text: string) {
        return Math.ceil(text.length / 4);
    }

    getConversationHistory() {
        return this.chatHistory;
    }

    resetConversation() {
        this.chatHistory = [];
        this.tokenUsageStats.conversationTokens = 0;
        this.tokenUsageStats.totalRequests = 0;
        this.tokenUsageStats.cacheHits = 0;
        this.tokenBreakdown = {
            totalPromptTokens: 0,
            totalResponseTokens: 0,
            totalBilledInputTokens: 0,
            perQuestion: []
        };
    }

    private cost(tokens: number, perMTokUSD: number) {
        return (tokens / 1_000_000) * perMTokUSD;
    }
}
