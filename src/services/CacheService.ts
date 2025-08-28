import { Repository } from 'typeorm';
import { CacheEntity } from '../entities/CacheEntity.js';
import { AppDataSource } from '../config/database.js';

export class CacheService {
    private cacheRepository: Repository<CacheEntity>;

    constructor() {
        this.cacheRepository = AppDataSource.getRepository(CacheEntity);
    }

    async saveCache(cacheData: {
        name: string;
        model: string;
        fileUri?: string;
        mimeType?: string;
        systemInstruction?: string;
        expireTime?: Date;
        cachedTokens: number;
        uploadedFileName?: string;
        metadata?: Record<string, any>;
    }): Promise<CacheEntity> {
        // Deactivate all existing caches
        await this.cacheRepository.update(
            { isActive: true },
            { isActive: false }
        );

        // Create new cache
        const cache = this.cacheRepository.create({
            ...cacheData,
            isActive: true
        });

        return await this.cacheRepository.save(cache);
    }

    async getActiveCache(): Promise<CacheEntity | null> {
        const cache = await this.cacheRepository.findOne({
            where: { isActive: true },
            order: { createdAt: 'DESC' }
        });

        if (!cache) return null;

        // Check if expired
        if (cache.expireTime && new Date() >= cache.expireTime) {
            cache.isActive = false;
            await this.cacheRepository.save(cache);
            return null;
        }

        return cache;
    }

    async getCacheByName(name: string): Promise<CacheEntity | null> {
        return await this.cacheRepository.findOne({
            where: { name }
        });
    }

    async updateCache(id: string, updates: Partial<CacheEntity>): Promise<CacheEntity | null> {
        await this.cacheRepository.update(id, updates);
        return await this.cacheRepository.findOne({ where: { id } });
    }

    async deleteCache(id: string): Promise<void> {
        await this.cacheRepository.delete(id);
    }

    async deleteCacheByName(name: string): Promise<void> {
        await this.cacheRepository.delete({ name });
    }

    async listCaches(limit = 50): Promise<CacheEntity[]> {
        return await this.cacheRepository.find({
            order: { createdAt: 'DESC' },
            take: limit
        });
    }

    async cleanupExpiredCaches(): Promise<number> {
        const now = new Date();
        const result = await this.cacheRepository
            .createQueryBuilder()
            .delete()
            .where('expireTime < :now', { now })
            .execute();

        return result.affected || 0;
    }

    async getCacheStats(): Promise<{
        total: number;
        active: number;
        expired: number;
        totalTokens: number;
    }> {
        const total = await this.cacheRepository.count();
        const active = await this.cacheRepository.count({ where: { isActive: true } });
        
        const now = new Date();
        const expired = await this.cacheRepository
            .createQueryBuilder('cache')
            .where('cache.expireTime < :now', { now })
            .getCount();

        const tokenSum = await this.cacheRepository
            .createQueryBuilder('cache')
            .select('SUM(cache.cachedTokens)', 'totalTokens')
            .where('cache.isActive = :active', { active: true })
            .getRawOne();

        return {
            total,
            active,
            expired,
            totalTokens: parseInt(tokenSum?.totalTokens || '0')
        };
    }
}
