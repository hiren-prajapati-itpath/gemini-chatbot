import * as fs from 'fs';
import * as path from 'path';
import { EnhancedCacheService } from './EnhancedCacheService.js';

export class DocumentWatcherService {
    private enhancedCacheService: EnhancedCacheService;
    private watcher?: fs.FSWatcher;
    private readonly PROFILE_DOCUMENT_PATH = path.join(process.cwd(), 'IT-Path-Solutions–Profile.md');
    private lastInvalidationTime = 0;
    private readonly DEBOUNCE_DELAY = 2000; // 2 seconds debounce

    constructor() {
        this.enhancedCacheService = new EnhancedCacheService();
    }

    /**
     * Start watching the document for changes
     */
    startWatching(): void {
        try {
            // Check if file exists
            if (!fs.existsSync(this.PROFILE_DOCUMENT_PATH)) {
                console.warn(`⚠️ Document not found: ${this.PROFILE_DOCUMENT_PATH}`);
                return;
            }

            console.log(`👀 Starting document watcher for: ${this.PROFILE_DOCUMENT_PATH}`);

            this.watcher = fs.watch(this.PROFILE_DOCUMENT_PATH, (eventType, filename) => {
                if (eventType === 'change') {
                    this.handleDocumentChange();
                }
            });

            console.log('✅ Document watcher started successfully');
        } catch (error) {
            console.error('❌ Failed to start document watcher:', error);
        }
    }

    /**
     * Stop watching the document
     */
    stopWatching(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = undefined;
            console.log('🛑 Document watcher stopped');
        }
    }

    /**
     * Handle document change with debouncing
     */
    private handleDocumentChange(): void {
        const now = Date.now();
        
        // Debounce rapid file changes
        if (now - this.lastInvalidationTime < this.DEBOUNCE_DELAY) {
            return;
        }
        
        this.lastInvalidationTime = now;
        
        console.log('📄 Document change detected, invalidating cache...');
        
        // Invalidate cache asynchronously
        this.invalidateCache().catch(error => {
            console.error('❌ Failed to invalidate cache after document change:', error);
        });
    }

    /**
     * Invalidate cache when document changes
     */
    private async invalidateCache(): Promise<void> {
        try {
            const result = await this.enhancedCacheService.invalidateCacheForDocumentUpdate();
            console.log(`✅ ${result.message}`);
        } catch (error) {
            console.error('❌ Error invalidating cache:', error);
            throw error;
        }
    }

    /**
     * Check if watcher is active
     */
    isWatching(): boolean {
        return this.watcher !== undefined;
    }

    /**
     * Get watched file path
     */
    getWatchedFilePath(): string {
        return this.PROFILE_DOCUMENT_PATH;
    }

    /**
     * Manual trigger for cache invalidation (for testing)
     */
    async manualInvalidate(): Promise<void> {
        console.log('🔧 Manual cache invalidation triggered');
        await this.invalidateCache();
    }
}

// Singleton instance
let watcherInstance: DocumentWatcherService | null = null;

/**
 * Get singleton instance of document watcher
 */
export function getDocumentWatcher(): DocumentWatcherService {
    if (!watcherInstance) {
        watcherInstance = new DocumentWatcherService();
    }
    return watcherInstance;
}

/**
 * Initialize document watcher (call this from your main app)
 */
export function initializeDocumentWatcher(): DocumentWatcherService {
    const watcher = getDocumentWatcher();
    watcher.startWatching();
    return watcher;
}
