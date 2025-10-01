// src/services/EnhancedUniversalSyncService.ts
import fs from 'fs';
import * as cron from 'node-cron';
import { WordPressService } from './wordpressService.js';
import DocumentSectionManager from './DocumentSectionManager.js';
import { SyncMetadataModel } from '../models/SyncMetadataModel.js';
import { syncConfig, documentTemplates } from '../config/syncConfig.js';
import { APIResponse } from '../interfaces/interface.js';

// Type definitions
type ContentType = 'blogs' | 'solutions' | 'caseStudies' | 'portfolio' | 'careers';

interface SyncResult {
    contentType: ContentType;
    success: boolean;
    totalFetched: number;
    newItems: number;
    updatedItems: number;
    skippedItems: number;
    errors: string[];
    syncDuration: number;
    lastSyncedAt: Date;
    nextSyncAt?: Date;
}

interface SyncReport {
    timestamp: string;
    results: SyncResult[];
    overallSuccess: boolean;
    totalProcessed: number;
    totalNew: number;
    totalUpdated: number;
    totalSkipped: number;
    totalErrors: number;
    apiType: string;
    isDifferentialSync: boolean;
}

interface ContentSectionConfig {
    targetSectionHeader: string;
    wpPostType: string;
    apiEndpoint: string;
    templateKey: ContentType;
    subsectionHeader?: string;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    itemsPerPage?: number;
    customFields?: string[];
}

export class EnhancedUniversalSyncService {
    private wordpressService: WordPressService;
    private documentManager: DocumentSectionManager;
    private logFile: string;
    private contentConfigs: Map<ContentType, ContentSectionConfig>;

    constructor() {
        this.wordpressService = new WordPressService();
        this.documentManager = new DocumentSectionManager();
        this.logFile = syncConfig.sync.logFile || './enhanced-sync.log';
        this.contentConfigs = this.initializeContentConfigs();
        this.ensureLogFile();
    }

    private initializeContentConfigs(): Map<ContentType, ContentSectionConfig> {
        const configs = new Map<ContentType, ContentSectionConfig>();

        configs.set('blogs', {
            targetSectionHeader: '## **IT Path Solutions – Blog Insights**',
            wpPostType: 'posts',
            apiEndpoint: '/posts',
            templateKey: 'blogs',
            sortField: 'date',
            sortOrder: 'desc',
            itemsPerPage: 50
        });

        configs.set('solutions', {
            targetSectionHeader: '## **IT Path Solutions – Solutions Overview**',
            wpPostType: 'solutions',
            apiEndpoint: '/solutions',
            templateKey: 'solutions',
            subsectionHeader: '### **Featured Custom-Tailored Solutions**',
            sortField: 'date',
            sortOrder: 'desc',
            itemsPerPage: 50
        });

        configs.set('caseStudies', {
            targetSectionHeader: '## **IT Path Solutions – Case Studies**',
            wpPostType: 'case_studies',
            apiEndpoint: '/case_studies',
            templateKey: 'caseStudies',
            subsectionHeader: '### **Featured Case Studies**',
            sortField: 'date',
            sortOrder: 'desc',
            itemsPerPage: 50
        });

        configs.set('portfolio', {
            targetSectionHeader: '## **IT Path Solutions – Portfolio**',
            wpPostType: 'portfolio_items',
            apiEndpoint: '/portfolio',
            templateKey: 'portfolio',
            subsectionHeader: '### **Featured Works – Custom Built**',
            sortField: 'date',
            sortOrder: 'desc',
            itemsPerPage: 50
        });

        configs.set('careers', {
            targetSectionHeader: '## **IT Path Solutions – Careers**',
            wpPostType: 'job_opening',
            apiEndpoint: '/job_opening',
            templateKey: 'careers',
            subsectionHeader: '### **Current Openings**',
            sortField: 'date',
            sortOrder: 'desc',
            itemsPerPage: 50
        });

        return configs;
    }

    private ensureLogFile(): void {
        if (!fs.existsSync(this.logFile)) {
            fs.writeFileSync(this.logFile, '');
        }
    }

    private log(message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] EnhancedSync: ${message}\n`;
        console.log(logMessage.trim());
        fs.appendFileSync(this.logFile, logMessage);
    }

    /**
     * Fetch content from WordPress with differential sync support
     */
    private async fetchContentWithDifferentialSync<T>(
        contentType: ContentType,
        config: ContentSectionConfig,
        lastSyncedAt?: Date
    ): Promise<{ items: T[], isIncremental: boolean }> {
        try {
            this.log(`Fetching ${contentType} from WordPress API (${config.apiEndpoint})...`);

            let params: any = {
                per_page: config.itemsPerPage || 50,
                orderby: config.sortField || 'date',
                order: config.sortOrder || 'desc',
                status: 'publish',
                _embed: true
            };

            // Add differential sync parameter if available
            let isIncremental = false;
            if (lastSyncedAt && lastSyncedAt.getTime() > new Date('1970-01-02').getTime()) {
                params.after = lastSyncedAt.toISOString();
                isIncremental = true;
                this.log(`Using differential sync for ${contentType}, fetching items after ${lastSyncedAt.toISOString()}`);
            } else {
                this.log(`Performing full sync for ${contentType} (no previous sync time found)`);
                
                // For full sync of blogs, increase the limit to get more historical data
                if (contentType === 'blogs') {
                    params.per_page = 100; // Get more posts for full sync
                    this.log(`Full blog sync: fetching up to ${params.per_page} posts per page`);
                }
            }

            let allContent: T[] = [];
            let page = 1;
            let hasMorePages = true;
            
            // For full sync, limit to reasonable number of pages to avoid overwhelming
            const maxPages = isIncremental ? 10 : (contentType === 'blogs' ? 5 : 3);

            while (hasMorePages && page <= maxPages) {
                const pageParams = { ...params, page };
                const response: APIResponse<T[]> = await this.wordpressService.get(
                    config.apiEndpoint,
                    pageParams
                );

                if (response.success && response.data) {
                    allContent = [...allContent, ...response.data];

                    if (response.pagination) {
                        hasMorePages = page < response.pagination.total_pages;
                        page++;
                        
                        // Log progress for large datasets
                        if (page % 5 === 0) {
                            this.log(`Fetched ${allContent.length} ${contentType} items so far (page ${page - 1}/${Math.min(response.pagination.total_pages, maxPages)})`);
                        }
                    } else {
                        hasMorePages = false;
                    }
                } else {
                    this.log(`API response failed for ${contentType} page ${page}: ${response.error}`);
                    hasMorePages = false;
                }
            }

            if (page > maxPages && hasMorePages) {
                this.log(`Reached maximum page limit (${maxPages}) for ${contentType}, fetched ${allContent.length} items`);
            }

            this.log(`Successfully fetched ${allContent.length} ${contentType} items (${isIncremental ? 'incremental' : 'full'} sync)`);
            return { items: allContent, isIncremental };

        } catch (error: any) {
            this.log(`Error fetching ${contentType}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Unified function to update any content section in the document
     */
    private async updateContentSection(
        contentType: ContentType,
        items: any[],
        config: ContentSectionConfig,
        isIncremental: boolean = false
    ): Promise<void> {
        try {
            this.log(`Updating document section for ${contentType} using unified processor...`);

            // Read current document
            const documentContent = this.documentManager.readDocument();
            
            let updatedContent: string;

            if (contentType === 'blogs') {
                if (isIncremental && items.length > 0) {
                    // For incremental sync, merge new posts with existing ones
                    this.log(`Blog incremental processing: Adding ${items.length} new blog posts to existing content`);
                    updatedContent = await this.mergeIncrementalBlogPosts(documentContent, items);
                } else {
                    // For full sync, replace entire section
                    const sortedItems = items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    const latestPosts = sortedItems.slice(0, 10);
                    const olderPosts = sortedItems.slice(10);

                    this.log(`Blog full processing: ${sortedItems.length} total blogs, showing ${latestPosts.length} latest + ${olderPosts.length} older`);
                    updatedContent = this.documentManager.updateBlogSections(documentContent, latestPosts, olderPosts);
                }
            } else {
                if (isIncremental && items.length > 0) {
                    // For other content types, merge new items with existing ones
                    this.log(`${contentType} incremental processing: Adding ${items.length} new items to existing content`);
                    updatedContent = await this.mergeIncrementalContent(documentContent, items, config, contentType);
                } else {
                    // For full sync, replace entire section
                    const newSectionContent = this.generateUnifiedSectionContent(contentType, items, config);
                    updatedContent = this.updateDocumentSectionPrecisely(
                        documentContent,
                        config.targetSectionHeader,
                        newSectionContent
                    );
                }
            }

            // Save the updated document
            this.documentManager.saveDocument(updatedContent);
            this.log(`Document section for ${contentType} updated successfully`);

        } catch (error: any) {
            this.log(`Error updating document section for ${contentType}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate unified section content using templates
     */
    private generateUnifiedSectionContent(
        contentType: ContentType,
        items: any[],
        config: ContentSectionConfig
    ): string {
        const template = documentTemplates[config.templateKey];
        if (!template) {
            throw new Error(`No template found for ${contentType}`);
        }

        let content = `${template.sectionTitle}\n\n`;
        
        if (template.introduction) {
            content += `${template.introduction}\n\n`;
        }

        // Add subsection header if specified
        if (config.subsectionHeader) {
            content += `${config.subsectionHeader}\n\n`;
        }

        // Generate items using the template
        if (items.length > 0) {
            items.forEach(item => {
                if (template.itemTemplate) {
                    content += template.itemTemplate(item) + '\n\n';
                }
            });
        } else {
            content += `*No ${contentType} available at this time.*\n\n`;
        }

        // Add closing section marker
        content += '---\n\n';

        return content;
    }

    /**
     * Merge incremental blog posts with existing content
     */
    private async mergeIncrementalBlogPosts(documentContent: string, newPosts: any[]): Promise<string> {
        try {
            // Extract existing blog posts from the document
            const existingPosts = this.extractExistingBlogPosts(documentContent);
            
            // Sort new posts by date (newest first)
            const sortedNewPosts = newPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            // Merge new posts with existing ones, avoiding duplicates
            const mergedPosts = this.mergeBlogPosts(existingPosts, sortedNewPosts);
            
            // Sort all posts by date (newest first)
            const allSortedPosts = mergedPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            // Update the document with merged posts
            const latestPosts = allSortedPosts.slice(0, 10);
            const olderPosts = allSortedPosts.slice(10);
            
            this.log(`Blog merge complete: ${allSortedPosts.length} total posts (${newPosts.length} new + ${existingPosts.length} existing), showing ${latestPosts.length} latest + ${olderPosts.length} older`);
            
            return this.documentManager.updateBlogSections(documentContent, latestPosts, olderPosts);
        } catch (error: any) {
            this.log(`Error merging incremental blog posts: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract existing blog posts from document content
     */
    private extractExistingBlogPosts(documentContent: string): any[] {
        const posts: any[] = [];
        
        try {
            // Find the blog section
            const blogSectionStart = documentContent.indexOf('## **IT Path Solutions – Blog Insights**');
            if (blogSectionStart === -1) {
                this.log('Blog section not found in document');
                return posts;
            }
            
            // Find the end of the blog section
            const nextSectionStart = documentContent.indexOf('\n## ', blogSectionStart + 1);
            const blogSectionEnd = nextSectionStart !== -1 ? nextSectionStart : documentContent.length;
            const blogSection = documentContent.substring(blogSectionStart, blogSectionEnd);
            
            // Extract blog entries using regex
            const blogEntryRegex = /-\s+\*\*(.*?)\*\*\s*\n\s*\*Posted on (.*?) by (.*?)\*\s*\n\s*(https?:\/\/[^\s]+)?/g;
            let match;
            
            while ((match = blogEntryRegex.exec(blogSection)) !== null) {
                const [, title, dateStr, author, link] = match;
                
                // Parse the date
                const date = new Date(dateStr);
                
                posts.push({
                    title: { rendered: title.replace(/&/g, '&#038;') },
                    date: date.toISOString(),
                    author: { name: author },
                    link: link || '',
                    // Add a unique identifier to avoid duplicates
                    slug: this.generateSlugFromTitle(title)
                });
            }
            
            this.log(`Extracted ${posts.length} existing blog posts from document`);
        } catch (error: any) {
            this.log(`Error extracting existing blog posts: ${error.message}`);
        }
        
        return posts;
    }

    /**
     * Merge blog posts avoiding duplicates
     */
    private mergeBlogPosts(existingPosts: any[], newPosts: any[]): any[] {
        const merged = [...existingPosts];
        
        for (const newPost of newPosts) {
            // Check if this post already exists (by title or slug)
            const exists = merged.some(existing => 
                existing.slug === (newPost.slug || this.generateSlugFromTitle(newPost.title?.rendered || newPost.title)) ||
                (existing.title?.rendered || existing.title) === (newPost.title?.rendered || newPost.title)
            );
            
            if (!exists) {
                // Add slug if not present
                if (!newPost.slug) {
                    newPost.slug = this.generateSlugFromTitle(newPost.title?.rendered || newPost.title);
                }
                merged.push(newPost);
                this.log(`Added new blog post: ${newPost.title?.rendered || newPost.title}`);
            } else {
                this.log(`Skipped duplicate blog post: ${newPost.title?.rendered || newPost.title}`);
            }
        }
        
        return merged;
    }

    /**
     * Generate slug from title for duplicate detection
     */
    private generateSlugFromTitle(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }

    /**
     * Merge incremental content for non-blog content types
     */
    private async mergeIncrementalContent(
        documentContent: string,
        newItems: any[],
        config: ContentSectionConfig,
        contentType: ContentType
    ): Promise<string> {
        try {
            this.log(`Performing incremental merge for ${contentType} - preserving existing items and inserting new ones`);

            // 1) Locate the section bounds
            const { sectionStartIndex, sectionEndIndex } = this.findSectionBounds(
                documentContent,
                config.targetSectionHeader
            );

            const sectionContent = documentContent.substring(sectionStartIndex, sectionEndIndex);

            // 2) Build a set of existing item slugs from the current section content
            const existingSlugs = this.extractExistingItemSlugs(sectionContent, contentType);

            // 3) Filter out duplicates from the incoming items
            const dedupedNewItems = newItems.filter((item) => {
                const title = this.getItemTitle(item, contentType);
                if (!title) return false;
                const slug = this.generateSlugFromTitle(title);
                return !existingSlugs.has(slug);
            });

            if (dedupedNewItems.length === 0) {
                this.log(`No new unique ${contentType} items to insert; section remains unchanged`);
                return documentContent;
            }

            // 4) Render only the new items using the template
            const renderedNewItems = this.renderItemsUsingTemplate(dedupedNewItems, config, contentType);

            // 5) Choose insertion point: prefer subsection header if configured, else after introduction, else right after section header
            const insertionIndex = this.getInsertionIndex(
                documentContent,
                { sectionStartIndex, sectionEndIndex },
                config,
                contentType
            );

            // 6) Insert new items text at the determined position
            const before = documentContent.substring(0, insertionIndex);
            const after = documentContent.substring(insertionIndex);

            // Ensure proper spacing: add two newlines around inserted block if needed
            const prefix = before.endsWith('\n\n') ? '' : (before.endsWith('\n') ? '\n' : '\n\n');
            const suffix = after.startsWith('\n\n') || renderedNewItems.endsWith('\n\n') ? '' : '\n\n';

            const updated = before + prefix + renderedNewItems + suffix + after;
            this.log(`Inserted ${dedupedNewItems.length} new ${contentType} item(s) at the top of the section`);
            return updated;
        } catch (error: any) {
            this.log(`Error merging incremental content for ${contentType}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Precisely update document section while preserving all other content
     */
    private updateDocumentSectionPrecisely(
        documentContent: string,
        targetSectionHeader: string,
        newSectionContent: string
    ): string {
        // Find the start of the target section
        const sectionStartIndex = documentContent.indexOf(targetSectionHeader);
        if (sectionStartIndex === -1) {
            throw new Error(`Target section header not found: ${targetSectionHeader}`);
        }

        // Find the end of the section (next ## header or end of document)
        const searchStartIndex = sectionStartIndex + targetSectionHeader.length;
        const nextSectionIndex = documentContent.indexOf('\n## ', searchStartIndex);
        const sectionEndIndex = nextSectionIndex !== -1 ? nextSectionIndex : documentContent.length;

        // Preserve content before and after the target section
        const beforeSection = documentContent.substring(0, sectionStartIndex);
        const afterSection = documentContent.substring(sectionEndIndex);

        // Combine with new section content
        return beforeSection + newSectionContent + afterSection;
    }

    /**
     * Find section start/end indices for a given target header
     */
    private findSectionBounds(documentContent: string, targetSectionHeader: string): { sectionStartIndex: number; sectionEndIndex: number } {
        const sectionStartIndex = documentContent.indexOf(targetSectionHeader);
        if (sectionStartIndex === -1) {
            throw new Error(`Target section header not found: ${targetSectionHeader}`);
        }

        const searchStartIndex = sectionStartIndex + targetSectionHeader.length;
        const nextSectionIndex = documentContent.indexOf('\n## ', searchStartIndex);
        const sectionEndIndex = nextSectionIndex !== -1 ? nextSectionIndex : documentContent.length;
        return { sectionStartIndex, sectionEndIndex };
    }

    /**
     * Extract existing item titles (as slugs) for de-duplication per content type
     */
    private extractExistingItemSlugs(sectionContent: string, contentType: ContentType): Set<string> {
        const slugs = new Set<string>();

        const pushMatches = (regex: RegExp) => {
            let m: RegExpExecArray | null;
            while ((m = regex.exec(sectionContent)) !== null) {
                let title = (m[1] || '').trim();
                if (title) {
                    // Apply type-specific cleanup (e.g., remove trailing parentheses like (Category) or (link))
                    title = this.sanitizeTitleForContentType(title, contentType);
                    slugs.add(this.generateSlugFromTitle(this.normalizeTitle(title)));
                }
            }
        };

        switch (contentType) {
            case 'solutions':
            case 'careers':
                // * **Title** (...)
                pushMatches(/^\*\s+\*\*(.+?)\*\*/gim);
                break;
            case 'portfolio':
                // **Project** – link
                pushMatches(/^\*\*(.+?)\*\*\s+[–—-]/gim);
                break;
            case 'caseStudies':
                // ### **Title**
                pushMatches(/^###\s+\*\*(.+?)\*\*/gim);
                break;
            case 'blogs':
                // Handled elsewhere; keep for completeness if invoked
                pushMatches(/^\-\s+\*\*(.+?)\*\*/gim);
                break;
        }

        return slugs;
    }

    /** Remove trailing parenthetical segments for certain types to align with item titles */
    private sanitizeTitleForContentType(title: string, contentType: ContentType): string {
        if (contentType === 'solutions' || contentType === 'careers') {
            // Strip a trailing parenthetical clause, e.g., "Some Title (Category)" or "Job (link)"
            return title.replace(/\s*\([^)]*\)\s*$/, '').trim();
        }
        return title;
    }

    /** Normalize HTML entities in title to match template rendering */
    private normalizeTitle(title: string): string {
        return title.replace(/&#038;/g, '&').replace(/&amp;/g, '&');
    }

    /**
     * Extract a display title from an item for slugging, per content type
     */
    private getItemTitle(item: any, contentType: ContentType): string | undefined {
        // Common title fields
        const rawTitle = item?.title?.rendered || item?.title;
        if (rawTitle) return this.normalizeTitle(String(rawTitle));

        // Content-type specific fallbacks
        switch (contentType) {
            case 'portfolio':
                return this.normalizeTitle(String(item?.project_name || item?.customFields?.projectName || '')) || undefined;
            case 'careers':
                return this.normalizeTitle(String(item?.job_title || item?.customFields?.jobTitle || '')) || undefined;
            case 'caseStudies':
                return this.normalizeTitle(String(item?.title?.rendered || item?.title || item?.project_name || '')) || undefined;
            default:
                return undefined;
        }
    }

    /**
     * Render a list of items using the configured template for a content type
     */
    private renderItemsUsingTemplate(items: any[], config: ContentSectionConfig, contentType: ContentType): string {
        const template = documentTemplates[config.templateKey];
        if (!template || !template.itemTemplate) {
            throw new Error(`No template found for ${contentType}`);
        }

        // Join with blank lines between items; ensure trailing newline for clean insertion
        const rendered = items.map((item) => template.itemTemplate(item)).join('\n\n');
        return rendered.endsWith('\n') ? rendered : rendered + '\n';
    }

    /**
     * Decide the best insertion index for new items within the section
     * Priority: subsectionHeader (if present in section) > introduction (if present) > just after section header
     */
    private getInsertionIndex(
        documentContent: string,
        bounds: { sectionStartIndex: number; sectionEndIndex: number },
        config: ContentSectionConfig,
        contentType: ContentType
    ): number {
        const { sectionStartIndex, sectionEndIndex } = bounds;

        // 1) Try subsection header if configured and present
        if (config.subsectionHeader) {
            const subHeaderIdx = documentContent.indexOf(config.subsectionHeader, sectionStartIndex);
            if (subHeaderIdx !== -1 && subHeaderIdx < sectionEndIndex) {
                return this.skipHeaderAndBlankLines(documentContent, subHeaderIdx + config.subsectionHeader.length, sectionEndIndex);
            }
        }

        // 2) Try introduction from the template
        const template = documentTemplates[config.templateKey];
        if (template?.introduction) {
            const introIdx = documentContent.indexOf(template.introduction, sectionStartIndex);
            if (introIdx !== -1 && introIdx < sectionEndIndex) {
                return this.skipHeaderAndBlankLines(documentContent, introIdx + template.introduction.length, sectionEndIndex);
            }
        }

        // 3) Fallback: right after the section header
        return this.skipHeaderAndBlankLines(documentContent, sectionStartIndex + config.targetSectionHeader.length, sectionEndIndex);
    }

    /** Move index past trailing spaces and blank lines, but not beyond sectionEndIndex */
    private skipHeaderAndBlankLines(documentContent: string, from: number, sectionEndIndex: number): number {
        let i = Math.min(from, sectionEndIndex);
        while (i < sectionEndIndex && (documentContent[i] === ' ' || documentContent[i] === '\t')) i++;
        // skip CRLF or LF sequences
        while (i < sectionEndIndex && (documentContent[i] === '\n' || documentContent[i] === '\r')) i++;
        return i;
    }

    /**
     * Perform enhanced sync for specific content type with differential support
     */
    async syncContentType(contentType: ContentType): Promise<SyncResult> {
        const startTime = Date.now();
        
        const result: SyncResult = {
            contentType,
            success: false,
            totalFetched: 0,
            newItems: 0,
            updatedItems: 0,
            skippedItems: 0,
            errors: [],
            syncDuration: 0,
            lastSyncedAt: new Date()
        };

        let syncMetadata: SyncMetadataModel | null = null;

        try {
            this.log(`=== Starting enhanced ${contentType} sync ===`);

            // Check if content type is enabled
            if (!syncConfig.contentTypes[contentType]?.enabled) {
                this.log(`${contentType} sync is disabled in configuration`);
                result.success = true;
                result.syncDuration = Date.now() - startTime;
                return result;
            }

            const config = this.contentConfigs.get(contentType);
            if (!config) {
                throw new Error(`No configuration found for content type: ${contentType}`);
            }

            // Initialize or get sync metadata
            syncMetadata = await SyncMetadataModel.initializeContentType(contentType, config.apiEndpoint);
            await syncMetadata.markSyncInProgress();

            // Get last sync time for differential sync
            const lastSyncedAt = await SyncMetadataModel.getLastSyncTime(contentType);
            
            // Fetch content with differential sync
            const { items, isIncremental } = await this.fetchContentWithDifferentialSync(
                contentType,
                config,
                lastSyncedAt || undefined
            );

            result.totalFetched = items.length;
            
            if (items.length > 0 || !isIncremental) {
                // Update document section using unified processor
                await this.updateContentSection(contentType, items, config, isIncremental);
                
                result.newItems = isIncremental ? items.length : items.length;
                result.updatedItems = 0; // For now, treating all as new in document context
            } else {
                this.log(`No new ${contentType} items found since last sync`);
                result.skippedItems = 0;
            }

            // Mark sync as complete
            await syncMetadata.markSyncComplete(
                result.totalFetched,
                result.newItems + result.updatedItems,
                result.errors.length,
                Date.now() - startTime
            );

            result.success = true;
            result.syncDuration = Date.now() - startTime;

            this.log(`=== ${contentType} sync completed successfully: ${result.newItems} new items processed in ${result.syncDuration}ms ===`);

        } catch (error: any) {
            result.errors.push(error.message);
            result.syncDuration = Date.now() - startTime;
            
            if (syncMetadata) {
                await syncMetadata.logError(error.message);
                await syncMetadata.markSyncComplete(
                    result.totalFetched,
                    result.newItems + result.updatedItems,
                    1,
                    result.syncDuration
                );
            }
            
            this.log(`${contentType} sync failed: ${error.message}`);
        }

        return result;
    }

    /**
     * Perform full enhanced sync for all content types
     */
    async performFullSync(): Promise<SyncReport> {
        const report: SyncReport = {
            timestamp: new Date().toISOString(),
            results: [],
            overallSuccess: true,
            totalProcessed: 0,
            totalNew: 0,
            totalUpdated: 0,
            totalSkipped: 0,
            totalErrors: 0,
            apiType: syncConfig.wordpress.apiType,
            isDifferentialSync: true
        };

        this.log('=== Starting Full Enhanced Universal Sync ===');

        const contentTypes: ContentType[] = ['blogs', 'solutions', 'caseStudies', 'portfolio', 'careers'];

        // Sort by priority if defined in sync config
        const sortedContentTypes = contentTypes.sort((a, b) => {
            const priorityA = syncConfig.contentTypes[a]?.priority || 999;
            const priorityB = syncConfig.contentTypes[b]?.priority || 999;
            return priorityA - priorityB;
        });

        for (const contentType of sortedContentTypes) {
            try {
                const result = await this.syncContentType(contentType);
                report.results.push(result);
                
                report.totalProcessed += result.totalFetched;
                report.totalNew += result.newItems;
                report.totalUpdated += result.updatedItems;
                report.totalSkipped += result.skippedItems;
                report.totalErrors += result.errors.length;

                if (!result.success) {
                    report.overallSuccess = false;
                }

                // Add small delay between content types to avoid overwhelming the API
                if (sortedContentTypes.indexOf(contentType) < sortedContentTypes.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (error: any) {
                report.results.push({
                    contentType,
                    success: false,
                    totalFetched: 0,
                    newItems: 0,
                    updatedItems: 0,
                    skippedItems: 0,
                    errors: [error.message],
                    syncDuration: 0,
                    lastSyncedAt: new Date()
                });
                report.totalErrors++;
                report.overallSuccess = false;
            }
        }

        this.log(`=== Full Enhanced Universal Sync Complete: ${report.totalProcessed} total fetched, ${report.totalNew} new, ${report.totalUpdated} updated, ${report.totalErrors} errors ===`);
        return report;
    }

    /**
     * Get sync status for all content types
     */
    async getSyncStatus(): Promise<SyncMetadataModel[]> {
        return await SyncMetadataModel.getAllSyncStatus();
    }

    /**
     * Get sync history for a specific content type
     */
    async getContentTypeSyncHistory(contentType: ContentType): Promise<SyncMetadataModel | null> {
        return await SyncMetadataModel.findOne({
            where: { contentType },
            order: [['lastSyncedAt', 'DESC']]
        });
    }

    /**
     * Force full resync for a content type (ignores last sync time)
     */
    async forceFullResync(contentType: ContentType): Promise<SyncResult> {
        this.log(`Forcing full resync for ${contentType} - will fetch ALL available content`);
        
        // Reset the last synced time to force full sync
        const metadata = await SyncMetadataModel.findOne({ where: { contentType } });
        if (metadata) {
            metadata.lastSyncedAt = new Date('1970-01-01');
            await metadata.save();
            this.log(`Reset last sync time for ${contentType} to force full sync`);
        }

        return await this.syncContentType(contentType);
    }

    /**
     * Start enhanced cron job for automatic sync
     */
    startEnhancedCronJob(): void {
        if (!syncConfig.sync.enableAutoSync) {
            this.log('Auto sync is disabled. Set ENABLE_AUTO_SYNC=true to enable.');
            return;
        }

        this.log(`Starting enhanced case studies sync cron job with schedule: ${syncConfig.sync.interval}`);

        cron.schedule(syncConfig.sync.interval, async () => {
            try {
                this.log('Starting scheduled enhanced universal sync...');
                const report = await this.performFullSync();
                
                if (report.overallSuccess) {
                    this.log(`Scheduled sync completed successfully: ${report.totalNew} new items, ${report.totalUpdated} updated items`);
                } else {
                    this.log(`Scheduled sync completed with errors: ${report.totalErrors} errors encountered`);
                }
            } catch (error: any) {
                this.log(`Scheduled enhanced sync failed: ${error.message}`);
            }
        });

        this.log('Enhanced universal sync cron job started successfully');
    }

    /**
     * Manual sync with enhanced options
     */
    async manualSync(options: {
        contentTypes?: ContentType[];
        forceFullSync?: boolean;
        skipValidation?: boolean;
    } = {}): Promise<SyncReport> {
        try {
            const { contentTypes, forceFullSync = false } = options;

            if (forceFullSync && contentTypes) {
                // Force full resync for specified content types
                for (const contentType of contentTypes) {
                    const metadata = await SyncMetadataModel.findOne({ where: { contentType } });
                    if (metadata) {
                        metadata.lastSyncedAt = new Date('1970-01-01');
                        await metadata.save();
                    }
                }
            }

            if (contentTypes && contentTypes.length > 0) {
                // Sync specific content types
                const report: SyncReport = {
                    timestamp: new Date().toISOString(),
                    results: [],
                    overallSuccess: true,
                    totalProcessed: 0,
                    totalNew: 0,
                    totalUpdated: 0,
                    totalSkipped: 0,
                    totalErrors: 0,
                    apiType: syncConfig.wordpress.apiType,
                    isDifferentialSync: true
                };

                for (const contentType of contentTypes) {
                    const result = await this.syncContentType(contentType);
                    report.results.push(result);
                    
                    report.totalProcessed += result.totalFetched;
                    report.totalNew += result.newItems;
                    report.totalUpdated += result.updatedItems;
                    report.totalSkipped += result.skippedItems;
                    report.totalErrors += result.errors.length;

                    if (!result.success) {
                        report.overallSuccess = false;
                    }
                }

                return report;
            } else {
                // Full sync
                return await this.performFullSync();
            }
        } catch (error: any) {
            this.log(`Manual enhanced sync failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get enhanced sync logs with filtering
     */
    getEnhancedLogs(options: {
        limit?: number;
        contentType?: ContentType;
        level?: 'all' | 'error' | 'success';
        since?: Date;
    } = {}): string[] {
        try {
            const { limit = 100, contentType, level = 'all', since } = options;
            
            const logs = fs.readFileSync(this.logFile, 'utf-8');
            let lines = logs.split('\n').filter(line => line.trim());

            // Filter by content type
            if (contentType) {
                lines = lines.filter(line => line.includes(contentType));
            }

            // Filter by level
            if (level === 'error') {
                lines = lines.filter(line => line.toLowerCase().includes('error') || line.toLowerCase().includes('failed'));
            } else if (level === 'success') {
                lines = lines.filter(line => line.toLowerCase().includes('success') || line.toLowerCase().includes('completed'));
            }

            // Filter by date
            if (since) {
                const sinceTime = since.getTime();
                lines = lines.filter(line => {
                    const timestampMatch = line.match(/\[([\d-T:.Z]+)\]/);
                    if (timestampMatch) {
                        const lineTime = new Date(timestampMatch[1]).getTime();
                        return lineTime >= sinceTime;
                    }
                    return false;
                });
            }

            return lines.slice(-limit);
        } catch (error) {
            return ['Could not read enhanced logs'];
        }
    }

    /**
     * Validate document structure before sync
     */
    async validateDocumentStructure(): Promise<{
        isValid: boolean;
        missingeSections: ContentType[];
        foundSections: ContentType[];
        recommendations: string[];
    }> {
        try {
            const documentContent = this.documentManager.readDocument();
            const validation = this.documentManager.validateDocumentStructure(documentContent);
            
            const recommendations: string[] = [];
            
            if (validation.missingeSections.length > 0) {
                recommendations.push(`Consider adding missing sections: ${validation.missingeSections.join(', ')}`);
            }
            
            if (!validation.isValid) {
                recommendations.push('Document structure is incomplete. Some content types may not sync properly.');
            }

            return {
                ...validation,
                recommendations
            };
        } catch (error: any) {
            return {
                isValid: false,
                missingeSections: [],
                foundSections: [],
                recommendations: [`Document validation failed: ${error.message}`]
            };
        }
    }
}

export default EnhancedUniversalSyncService;
