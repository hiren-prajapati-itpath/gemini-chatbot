export interface TokenUsage {
    promptTokens: number;
    responseTokens: number;
    cachedTokens: number;
    billedInputTokens: number;
    totalTokens: number;
    estimated?: boolean;
}

export interface TokenQuestion {
    question: string;
    promptTokens: number;
    responseTokens: number;
    cachedTokens: number;
    billedInputTokens: number;
    totalTokens: number;
    timestamp: string;
    mode: 'standard' | 'ultra' | 'stream' | 'chat';
    estimated?: boolean;
    sessionId?: string;
}

export interface TokenBreakdown {
    totalPromptTokens: number;
    totalResponseTokens: number;
    totalBilledInputTokens: number;
    perQuestion: TokenQuestion[];
}

export interface TokenStats {
    cacheTokens: number;
    conversationTokens: number;
    totalRequests: number;
    cacheHits: number;
}

export interface CostAnalysis {
    overview: {
        cacheTokens: number;
        conversationTokens: number;
        totalRequests: number;
        cacheHits: number;
        cacheHitRate: number;
        conversationRounds: number;
    };
    inputComparison: {
        withCaching: { tokens: number; costUSD: number };
        withoutCaching: { tokens: number; costUSD: number };
        saved: { tokens: number; costUSD: number; percent: number };
    };
    cacheCosts: {
        createOnceUSD: number;
        storagePerHourUSD: number;
        expiresAt: string | null;
    };
    meansPerQuestion: {
        promptTokens: number;
        billedInputTokens: number;
        responseTokens: number;
        totalTokens: number;
    };
}

export class TokenAccountingService {
    private tokenUsageStats: TokenStats = {
        cacheTokens: 0,
        conversationTokens: 0,
        totalRequests: 0,
        cacheHits: 0
    };

    private tokenBreakdown: TokenBreakdown = {
        totalPromptTokens: 0,
        totalResponseTokens: 0,
        totalBilledInputTokens: 0,
        perQuestion: []
    };

    // Pricing (USD per 1M tokens). Can be overridden using env vars.
    private PRICING = {
        INPUT_PER_MTOK: Number(process.env.GEM_INPUT_PER_MTOK ?? 0.10),
        OUTPUT_PER_MTOK: Number(process.env.GEM_OUTPUT_PER_MTOK ?? 0.40),
        CACHE_CREATE_PER_MTOK: Number(process.env.GEM_CACHE_CREATE_PER_MTOK ?? 0.025),
        CACHE_STORAGE_PER_MTOK_PER_HR: Number(process.env.GEM_CACHE_STORAGE_PER_MTOK_PER_HR ?? 1.0)
    };

    constructor(cacheTokens: number = 0) {
        this.tokenUsageStats.cacheTokens = cacheTokens;
    }

    updateTokenStats(
        question: string,
        usage: TokenUsage,
        mode: 'standard' | 'ultra' | 'stream' | 'chat' = 'standard',
        sessionId?: string
    ): void {
        // Update running totals
        this.tokenUsageStats.conversationTokens += usage.promptTokens + usage.responseTokens;
        this.tokenBreakdown.totalPromptTokens += usage.promptTokens;
        this.tokenBreakdown.totalResponseTokens += usage.responseTokens;
        this.tokenBreakdown.totalBilledInputTokens += usage.billedInputTokens;
        
        // Track per-question details
        this.tokenBreakdown.perQuestion.push({
            question,
            promptTokens: usage.promptTokens,
            responseTokens: usage.responseTokens,
            cachedTokens: usage.cachedTokens,
            billedInputTokens: usage.billedInputTokens,
            totalTokens: usage.totalTokens,
            timestamp: new Date().toISOString(),
            mode,
            estimated: usage.estimated,
            sessionId
        });

        // Update request counters
        this.tokenUsageStats.totalRequests++;
        if (usage.cachedTokens > 0) {
            this.tokenUsageStats.cacheHits++;
        }

        // Log detailed token usage
        this.logTokenUsage(question, usage, mode, sessionId);
    }

    private logTokenUsage(
        question: string,
        usage: TokenUsage,
        mode: string,
        sessionId?: string
    ): void {
        const inputCost = this.cost(usage.billedInputTokens, this.PRICING.INPUT_PER_MTOK);
        const outputCost = this.cost(usage.responseTokens, this.PRICING.OUTPUT_PER_MTOK);
        const storagePerHour = this.cost(this.tokenUsageStats.cacheTokens, this.PRICING.CACHE_STORAGE_PER_MTOK_PER_HR);
        const tag = usage.estimated ? '[Token Usage - Estimated]' : '[Token Usage]';
        
        console.log(tag);
        console.log(`${sessionId ? `Session ${sessionId} - ` : ''}Q#${this.tokenUsageStats.totalRequests}: ${question}`);
        console.log(`- promptTokens (includes cache): ${usage.promptTokens}`);
        console.log(`- cachedTokens (reused, not billed on input): ${usage.cachedTokens}${usage.estimated ? ' (n/a in stream)' : ''}`);
        console.log(`- new input tokens billed: ${usage.billedInputTokens}${usage.estimated ? ' (estimated)' : ''}`);
        console.log(`- output tokens billed: ${usage.responseTokens}${usage.estimated ? ' (estimated)' : ''}`);
        console.log(`- est. input cost: $${inputCost.toFixed(6)} | est. output cost: $${outputCost.toFixed(6)}`);
        console.log(`- cache storage (per hour): $${storagePerHour.toFixed(5)} for ${this.tokenUsageStats.cacheTokens} tokens`);
        console.log(`- mode: ${mode}${sessionId ? ` | session: ${sessionId}` : ''}`);
    }

    getTokenAnalyticsDetailed(limit = 100): {
        totals: {
            requests: number;
            promptTokens: number;
            billedInputTokens: number;
            responseTokens: number;
            totalTokens: number;
        };
        means: {
            perQuestion: number;
            input: number;
            inputBilled: number;
            output: number;
        };
        perQuestion: TokenQuestion[];
    } {
        const total = this.tokenUsageStats.totalRequests || 1;
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
                input: Number((this.tokenBreakdown.totalPromptTokens / total).toFixed(1)),
                inputBilled: Number((this.tokenBreakdown.totalBilledInputTokens / total).toFixed(1)),
                output: Number((this.tokenBreakdown.totalResponseTokens / total).toFixed(1))
            },
            perQuestion: this.tokenBreakdown.perQuestion.slice(-limit)
        };
    }

    calculateCostSavings(): CostAnalysis {
        const totalRequests = this.tokenUsageStats.totalRequests || 1;
        const cacheTokens = this.tokenUsageStats.cacheTokens;
        const totalNewInputTokens = this.tokenBreakdown.totalBilledInputTokens;
        
        // Calculate savings from caching
        const inputTokensWithoutCaching = totalNewInputTokens + (cacheTokens * totalRequests);
        const inputTokensWithCaching = totalNewInputTokens;
        const inputTokensSaved = Math.max(0, inputTokensWithoutCaching - inputTokensWithCaching);
        
        // Cost calculations
        const inputCostWithoutCachingUSD = this.cost(inputTokensWithoutCaching, this.PRICING.INPUT_PER_MTOK);
        const inputCostWithCachingUSD = this.cost(inputTokensWithCaching, this.PRICING.INPUT_PER_MTOK);
        const inputCostSavedUSD = inputCostWithoutCachingUSD - inputCostWithCachingUSD;
        
        const cacheCreateCostUSD = this.cost(cacheTokens, this.PRICING.CACHE_CREATE_PER_MTOK);
        const cacheStoragePerHourUSD = this.cost(cacheTokens, this.PRICING.CACHE_STORAGE_PER_MTOK_PER_HR);
        
        return {
            overview: {
                cacheTokens,
                conversationTokens: this.tokenUsageStats.conversationTokens,
                totalRequests,
                cacheHits: this.tokenUsageStats.cacheHits,
                cacheHitRate: totalRequests > 0 ? Number(((this.tokenUsageStats.cacheHits / totalRequests) * 100).toFixed(1)) : 0,
                conversationRounds: Math.floor(this.tokenBreakdown.perQuestion.length / 2)
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
                expiresAt: null // Will be set by caller if cache info available
            },
            meansPerQuestion: {
                promptTokens: Number((this.tokenBreakdown.totalPromptTokens / totalRequests).toFixed(1)),
                billedInputTokens: Number((this.tokenBreakdown.totalBilledInputTokens / totalRequests).toFixed(1)),
                responseTokens: Number((this.tokenBreakdown.totalResponseTokens / totalRequests).toFixed(1)),
                totalTokens: Number(((this.tokenBreakdown.totalPromptTokens + this.tokenBreakdown.totalResponseTokens) / totalRequests).toFixed(1))
            }
        };
    }

    getCostBreakdown() {
        const total = this.tokenUsageStats.totalRequests || 1;
        const cacheTokens = this.tokenUsageStats.cacheTokens;
        const avgNewInputTokens = this.tokenBreakdown.totalBilledInputTokens / total;
        const avgOutputTokens = this.tokenBreakdown.totalResponseTokens / total;

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
            }
        };
    }

    resetStats(): void {
        this.tokenUsageStats = {
            cacheTokens: this.tokenUsageStats.cacheTokens, // Keep cache tokens
            conversationTokens: 0,
            totalRequests: 0,
            cacheHits: 0
        };
        this.tokenBreakdown = {
            totalPromptTokens: 0,
            totalResponseTokens: 0,
            totalBilledInputTokens: 0,
            perQuestion: []
        };
    }

    private cost(tokens: number, perMTokUSD: number): number {
        return (tokens / 1_000_000) * perMTokUSD;
    }

    // Getters for compatibility
    get stats(): TokenStats {
        return { ...this.tokenUsageStats };
    }

    get breakdown(): TokenBreakdown {
        return { ...this.tokenBreakdown };
    }
}
