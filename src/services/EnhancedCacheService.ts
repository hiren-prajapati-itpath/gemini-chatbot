import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { Op } from 'sequelize';
import { CacheModel, CacheCreationAttributes } from '../models/CacheModel.js';
import { DocumentCacheModel } from '../models/DocumentCacheModel.js';

export interface DocumentCacheInfo {
    documentPath: string;
    documentHash: string;
    lastModified: Date;
    isValid: boolean;
}

export interface CacheValidationResult {
    isValid: boolean;
    reason: 'valid' | 'expired' | 'document_changed' | 'not_found' | 'expired_document_unchanged';
    shouldRecreate: boolean;
    shouldExtendTTL?: boolean;
    documentInfo?: DocumentCacheInfo;
}

export class EnhancedCacheService {
    private readonly PROFILE_DOCUMENT_PATH = path.join(process.cwd(), 'IT-Path-Solutions–Profile.md');
    private readonly CACHE_TTL = process.env.CACHE_TTL ?? '28800s'; // 8 hours
    private readonly AUTO_EXTEND_TTL = process.env.AUTO_EXTEND_TTL !== 'false';

    /**
     * Save cache with document tracking
     */
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

        // Track document state for this cache
        await this.createDocumentCacheEntry(cache.id);

        return cache;
    }

    /**
     * Get active cache with validation
     */
    async getActiveCache(): Promise<CacheModel | null> {
        const cache = await CacheModel.findOne({
            where: { isActive: true },
            order: [['createdAt', 'DESC']]
        });

        if (!cache) return null;

        // Validate cache
        const validation = await this.validateCache(cache);
        
        if (!validation.isValid) {
            console.log(`Cache invalid: ${validation.reason}`);
            
            // Mark cache as inactive
            cache.isActive = false;
            await cache.save();

            // Mark document cache entries as invalid
            await this.invalidateDocumentCacheEntries(cache.id);
            
            return null;
        }

        return cache;
    }

    /**
     * Validate cache against expiry and document changes with TTL extension logic
     */
    async validateCache(cache: CacheModel): Promise<CacheValidationResult> {
        // Check if cache is expired
        if (cache.expireTime && new Date() >= cache.expireTime) {
            // Check document changes for expired cache
            const documentValidation = await this.validateDocumentCache(cache.id);
            
            if (documentValidation.isValid && this.AUTO_EXTEND_TTL) {
                // Document unchanged and TTL extension enabled - always try to extend TTL
                return {
                    isValid: false,
                    reason: 'expired_document_unchanged',
                    shouldRecreate: false,
                    shouldExtendTTL: true,
                    documentInfo: documentValidation.documentInfo
                };
            } else if (!documentValidation.isValid) {
                // Document changed - need to recreate
                return {
                    isValid: false,
                    reason: 'document_changed',
                    shouldRecreate: true,
                    shouldExtendTTL: false,
                    documentInfo: documentValidation.documentInfo
                };
            } else {
                // TTL extension disabled - lazy recreation
                return {
                    isValid: false,
                    reason: 'expired',
                    shouldRecreate: false,
                    shouldExtendTTL: false
                };
            }
        }

        // Check document changes for non-expired cache
        const documentValidation = await this.validateDocumentCache(cache.id);
        
        if (!documentValidation.isValid) {
            return {
                isValid: false,
                reason: 'document_changed',
                shouldRecreate: true,
                shouldExtendTTL: false,
                documentInfo: documentValidation.documentInfo
            };
        }

        return {
            isValid: true,
            reason: 'valid',
            shouldRecreate: false,
            shouldExtendTTL: false
        };
    }

    /**
     * Create document cache entry for tracking
     */
    private async createDocumentCacheEntry(cacheId: string): Promise<void> {
        try {
            const documentInfo = await this.getDocumentInfo(this.PROFILE_DOCUMENT_PATH);
            
            await DocumentCacheModel.create({
                documentPath: this.PROFILE_DOCUMENT_PATH,
                documentHash: documentInfo.documentHash,
                lastModified: documentInfo.lastModified,
                cacheId: cacheId,
                isValid: true
            });

            console.log(`📄 Document cache entry created for cache: ${cacheId}`);
        } catch (error) {
            console.error('Failed to create document cache entry:', error);
            throw error;
        }
    }

    /**
     * Validate document cache against current document state
     */
    private async validateDocumentCache(cacheId: string): Promise<{
        isValid: boolean;
        documentInfo?: DocumentCacheInfo;
    }> {
        try {
            const documentCache = await DocumentCacheModel.findOne({
                where: { 
                    cacheId: cacheId,
                    isValid: true 
                }
            });

            if (!documentCache) {
                return { isValid: false };
            }

            const currentDocumentInfo = await this.getDocumentInfo(this.PROFILE_DOCUMENT_PATH);
            
            // Check if document has changed
            const hasChanged = documentCache.documentHash !== currentDocumentInfo.documentHash ||
                             documentCache.lastModified.getTime() !== currentDocumentInfo.lastModified.getTime();

            if (hasChanged) {
                console.log(`📄 Document changed detected:
                    - Cached hash: ${documentCache.documentHash}
                    - Current hash: ${currentDocumentInfo.documentHash}
                    - Cached modified: ${documentCache.lastModified}
                    - Current modified: ${currentDocumentInfo.lastModified}`);
                
                return { 
                    isValid: false,
                    documentInfo: {
                        documentPath: this.PROFILE_DOCUMENT_PATH,
                        documentHash: currentDocumentInfo.documentHash,
                        lastModified: currentDocumentInfo.lastModified,
                        isValid: false
                    }
                };
            }

            return { isValid: true };
        } catch (error) {
            console.error('Error validating document cache:', error);
            return { isValid: false };
        }
    }

    /**
     * Get document information (hash and last modified)
     */
    private async getDocumentInfo(documentPath: string): Promise<{
        documentHash: string;
        lastModified: Date;
    }> {
        const stats = await fs.promises.stat(documentPath);
        const content = await fs.promises.readFile(documentPath, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        return {
            documentHash: hash,
            lastModified: stats.mtime
        };
    }

    /**
     * Invalidate document cache entries
     */
    private async invalidateDocumentCacheEntries(cacheId: string): Promise<void> {
        await DocumentCacheModel.update(
            { isValid: false },
            { where: { cacheId: cacheId } }
        );
    }

    /**
     * Extend cache TTL using the existing updateCacheTTL method from GeminiCachingChatbot
     */
    async extendCacheTTL(cache: CacheModel, chatbotInstance?: any): Promise<{
        success: boolean;
        newExpireTime?: Date;
        message: string;
    }> {
        try {
            // If chatbot instance is provided, use its updateCacheTTL method
            if (chatbotInstance && chatbotInstance.cache && chatbotInstance.cache.name === cache.name) {
                const updatedCache = await chatbotInstance.updateCacheTTL(this.CACHE_TTL);
                const newExpireTime = updatedCache.expireTime ? new Date(updatedCache.expireTime) : undefined;

                // Update database record with new expiry time
                await this.updateCache(cache.id, {
                    expireTime: newExpireTime,
                    metadata: {
                        ...(cache.metadata as any || {}),
                        lastTtlExtension: new Date()
                    }
                });

                console.log(`✅ Extended TTL for cache: ${cache.name}`);
                console.log(`   New expiry: ${newExpireTime}`);

                return {
                    success: true,
                    newExpireTime,
                    message: `TTL extended successfully`
                };
            }

            // Fallback: Direct Gemini API call if no chatbot instance
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

            // Update TTL in Gemini API directly
            const updatedCache = await ai.caches.update({
                name: cache.name,
                config: { ttl: this.CACHE_TTL }
            });

            const newExpireTime = updatedCache.expireTime ? new Date(updatedCache.expireTime) : undefined;

            // Update database record
            await this.updateCache(cache.id, {
                expireTime: newExpireTime,
                metadata: {
                    ...(cache.metadata as any || {}),
                    lastTtlExtension: new Date()
                }
            });

            console.log(`✅ Extended TTL for cache: ${cache.name}`);
            console.log(`   New expiry: ${newExpireTime}`);

            return {
                success: true,
                newExpireTime,
                message: `TTL extended successfully`
            };

        } catch (error: any) {
            console.error('❌ Failed to extend cache TTL:', error);
            return {
                success: false,
                message: `Failed to extend TTL: ${error.message}`
            };
        }
    }

    /**
     * Check if cache should be recreated based on document changes with TTL extension logic
     */
    async shouldRecreateCache(): Promise<{
        shouldRecreate: boolean;
        shouldExtendTTL: boolean;
        reason: string;
        hasDocumentChanged: boolean;
    }> {
        const activeCache = await this.getActiveCache();
        
        if (!activeCache) {
            return {
                shouldRecreate: true,
                shouldExtendTTL: false,
                reason: 'No active cache found',
                hasDocumentChanged: false
            };
        }

        const validation = await this.validateCache(activeCache);
        
        return {
            shouldRecreate: !validation.isValid && (validation.shouldRecreate || false),
            shouldExtendTTL: !validation.isValid && (validation.shouldExtendTTL || false),
            reason: validation.reason,
            hasDocumentChanged: validation.reason === 'document_changed'
        };
    }

    /**
     * Get cache by name with document validation
     */
    async getCacheByName(name: string): Promise<CacheModel | null> {
        const cache = await CacheModel.findOne({
            where: { name }
        });

        if (!cache) return null;

        const validation = await this.validateCache(cache);
        if (!validation.isValid) {
            return null;
        }

        return cache;
    }

    /**
     * Update cache
     */
    async updateCache(id: string, updates: Partial<CacheModel>): Promise<CacheModel | null> {
        const [affectedCount] = await CacheModel.update(updates, {
            where: { id }
        });

        if (affectedCount === 0) return null;

        return await CacheModel.findByPk(id);
    }

    /**
     * Delete cache and associated document cache entries
     */
    async deleteCache(id: string): Promise<void> {
        // Delete document cache entries first
        await DocumentCacheModel.destroy({
            where: { cacheId: id }
        });

        // Delete cache
        await CacheModel.destroy({
            where: { id }
        });
    }

    /**
     * Delete cache by name
     */
    async deleteCacheByName(name: string): Promise<void> {
        const cache = await CacheModel.findOne({ where: { name } });
        if (cache) {
            await this.deleteCache(cache.id);
        }
    }

    /**
     * List caches with validation status
     */
    async listCaches(limit = 50): Promise<Array<CacheModel & { validationStatus?: CacheValidationResult }>> {
        const caches = await CacheModel.findAll({
            order: [['createdAt', 'DESC']],
            limit
        });

        // Add validation status to each cache
        const cachesWithValidation = await Promise.all(
            caches.map(async (cache) => {
                const validationStatus = await this.validateCache(cache);
                return Object.assign(cache, { validationStatus });
            })
        );

        return cachesWithValidation;
    }

    /**
     * Cleanup expired caches and invalid document cache entries
     */
    async cleanupExpiredCaches(): Promise<{
        deletedCaches: number;
        invalidatedDocumentCaches: number;
    }> {
        const now = new Date();
        
        // Find expired caches
        const expiredCaches = await CacheModel.findAll({
            where: {
                expireTime: {
                    [Op.lt]: now
                }
            }
        });

        // Delete expired caches and their document cache entries
        let deletedCaches = 0;
        let invalidatedDocumentCaches = 0;

        for (const cache of expiredCaches) {
            await this.deleteCache(cache.id);
            deletedCaches++;
        }

        // Also cleanup orphaned document cache entries
        const orphanedDocumentCaches = await DocumentCacheModel.count({
            where: {
                cacheId: {
                    [Op.notIn]: (await CacheModel.findAll({ attributes: ['id'] })).map(c => c.id)
                }
            }
        });

        await DocumentCacheModel.destroy({
            where: {
                cacheId: {
                    [Op.notIn]: (await CacheModel.findAll({ attributes: ['id'] })).map(c => c.id)
                }
            }
        });

        invalidatedDocumentCaches = orphanedDocumentCaches;

        return {
            deletedCaches,
            invalidatedDocumentCaches
        };
    }

    /**
     * Get cache statistics with document tracking info
     */
    async getCacheStats(): Promise<{
        total: number;
        active: number;
        expired: number;
        documentInvalid: number;
        totalTokens: number;
        documentCacheEntries: number;
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

        // Count caches with invalid documents
        const documentInvalid = await DocumentCacheModel.count({
            where: { isValid: false }
        });

        const tokenSum = await CacheModel.sum('cachedTokens', {
            where: { isActive: true }
        });

        const documentCacheEntries = await DocumentCacheModel.count();

        return {
            total,
            active,
            expired,
            documentInvalid,
            totalTokens: tokenSum || 0,
            documentCacheEntries
        };
    }

    /**
     * Force invalidate cache when document is updated
     */
    async invalidateCacheForDocumentUpdate(): Promise<{
        invalidatedCaches: number;
        message: string;
    }> {
        // Mark all active caches as inactive
        const [affectedCount] = await CacheModel.update(
            { isActive: false },
            { where: { isActive: true } }
        );

        // Mark all document cache entries as invalid
        await DocumentCacheModel.update(
            { isValid: false },
            { where: { isValid: true } }
        );

        const message = `Invalidated ${affectedCount} caches due to document update. New cache will be created lazily on next request.`;
        console.log(`🔄 ${message}`);

        return {
            invalidatedCaches: affectedCount,
            message
        };
    }
}
