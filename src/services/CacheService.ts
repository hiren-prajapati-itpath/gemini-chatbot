import { Op } from 'sequelize';
import { CacheModel, CacheCreationAttributes } from '../models/CacheModel.js';

export class CacheService {
    async saveCache(cacheData: CacheCreationAttributes): Promise<CacheModel> {
        // Deactivate all existing caches
        await CacheModel.update(
            { isActive: false },
            { where: { isActive: true } }
        );

        // Create new cache
        const cache = await CacheModel.create({
            ...cacheData,
            isActive: true
        });

        return cache;
    }

    async getActiveCache(): Promise<CacheModel | null> {
        const cache = await CacheModel.findOne({
            where: { isActive: true },
            order: [['createdAt', 'DESC']]
        });

        if (!cache) return null;

        // Check if expired
        if (cache.expireTime && new Date() >= cache.expireTime) {
            cache.isActive = false;
            await cache.save();
            return null;
        }

        return cache;
    }

    async getCacheByName(name: string): Promise<CacheModel | null> {
        return await CacheModel.findOne({
            where: { name }
        });
    }

    async updateCache(id: string, updates: Partial<CacheModel>): Promise<CacheModel | null> {
        const [affectedCount] = await CacheModel.update(updates, {
            where: { id }
        });

        if (affectedCount === 0) return null;

        return await CacheModel.findByPk(id);
    }

    async deleteCache(id: string): Promise<void> {
        await CacheModel.destroy({
            where: { id }
        });
    }

    async deleteCacheByName(name: string): Promise<void> {
        await CacheModel.destroy({
            where: { name }
        });
    }

    async listCaches(limit = 50): Promise<CacheModel[]> {
        return await CacheModel.findAll({
            order: [['createdAt', 'DESC']],
            limit
        });
    }

    async cleanupExpiredCaches(): Promise<number> {
        const now = new Date();
        const deletedCount = await CacheModel.destroy({
            where: {
                expireTime: {
                    [Op.lt]: now
                }
            }
        });

        return deletedCount;
    }

    async getCacheStats(): Promise<{
        total: number;
        active: number;
        expired: number;
        totalTokens: number;
    }> {
        const total = await CacheModel.count();
        const active = await CacheModel.count({ where: { isActive: true } });
        
        const now = new Date();
        const expired = await CacheModel.count({
            where: {
                expireTime: {
                    [Op.lt]: now
                }
            }
        });

        const tokenSum = await CacheModel.sum('cachedTokens', {
            where: { isActive: true }
        });

        return {
            total,
            active,
            expired,
            totalTokens: tokenSum || 0
        };
    }
}
