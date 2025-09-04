import { SessionStorageService } from '../services/storage/SessionStorageService.js';
import { RedisSessionStorage } from '../services/storage/RedisSessionStorage.js';
import { InMemorySessionStorage } from '../services/storage/InMemorySessionStorage.js';

export interface StorageConfig {
    type: 'redis' | 'memory';
    redis?: {
        url?: string;
        enableFallback?: boolean;
    };
}

export class StorageFactory {
    static async createStorageService(config?: StorageConfig): Promise<SessionStorageService> {
        const storageType = config?.type || process.env.SESSION_STORAGE_TYPE || 'memory';
        
        switch (storageType) {
            case 'redis':
                return await this.createRedisStorage(config?.redis);
            
            case 'memory':
            default:
                return new InMemorySessionStorage();
        }
    }

    private static async createRedisStorage(redisConfig?: { url?: string; enableFallback?: boolean }): Promise<SessionStorageService> {
        try {
            const redisUrl = redisConfig?.url || process.env.REDIS_URL;
            const storage = new RedisSessionStorage(redisUrl);
            
            // Test Redis connection
            const isHealthy = await storage.isHealthy();
            if (!isHealthy) {
                throw new Error('Redis health check failed');
            }
            
            console.log('✅ Redis session storage initialized');
            return storage;
        } catch (error) {
            console.error('❌ Failed to initialize Redis storage:', error);
            
            // Fallback to in-memory if enabled
            if (redisConfig?.enableFallback !== false) {
                console.log('🔄 Falling back to in-memory session storage');
                return new InMemorySessionStorage();
            }
            
            throw error;
        }
    }

    // Utility method to get recommended storage type based on environment
    static getRecommendedStorageType(): 'redis' | 'memory' {
        if (process.env.NODE_ENV === 'production') {
            return 'redis';
        }
        return 'memory';
    }

    // Helper to validate Redis URL format
    static isValidRedisUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'redis:' || parsed.protocol === 'rediss:';
        } catch {
            return false;
        }
    }
}
