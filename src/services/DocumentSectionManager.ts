import { WordPressService } from './wordpressService.js';
// src/services/DocumentSectionManager.ts
import fs from 'fs'; 
import { syncConfig } from '../config/syncConfig.js';

// Type definitions
type ContentType = 'blogs' | 'solutions' | 'caseStudies' | 'portfolio' | 'careers';

interface DocumentSection {
    startMarker: string;
    endMarker?: string;
    subsections?: {
        [key: string]: string;
    };
}

interface SectionContent {
    contentType: ContentType;
    startIndex: number;
    endIndex: number;
    currentContent: string;
    hasSubsections: boolean;
    subsectionIndices?: {
        [key: string]: {
            startIndex: number;
            endIndex: number;
        };
    };
}

// Section markers for different content types in your document
const DOCUMENT_SECTIONS: Record<ContentType, DocumentSection> = {
    blogs: {
        startMarker: '## **IT Path Solutions – Blog Insights**',
        endMarker: '## **IT Path Solutions –',
        subsections: {
            latest: '### **Latest Blog Posts**',
            older: '### **Older Posts (earlier entries)**'
        }
    },
    solutions: {
        startMarker: '## **IT Path Solutions – Solutions Overview**',
        endMarker: '## **IT Path Solutions –',
        subsections: {
            featured: '### **Featured Custom-Tailored Solutions**'
        }
    },
    caseStudies: {
        startMarker: '## **IT Path Solutions – Case Studies**',
        endMarker: '## **IT Path Solutions –',
        subsections: {
            featured: '### **Featured Case Studies**'
        }
    },
    portfolio: {
        startMarker: '## **IT Path Solutions – Portfolio**',
        endMarker: '## **IT Path Solutions –',
        subsections: {
            featured: '### **Featured Works – Custom Built**'
        }
    },
    careers: {
        startMarker: '## **IT Path Solutions – Careers**',
        endMarker: '## **IT Path Solutions –',
        subsections: {
            current: '### **Current Openings**'
        }
    },
};

export class DocumentSectionManager {
    private documentPath: string;
    private logFile: string;
    private wordpressService: WordPressService = new WordPressService();

    constructor() {
        this.documentPath = syncConfig.sync.documentPath;
        this.logFile = syncConfig.sync.logFile || './document-section.log';
        this.ensureLogFile();
    }

    private ensureLogFile(): void {
        if (!fs.existsSync(this.logFile)) {
            fs.writeFileSync(this.logFile, '');
        }
    }

    private log(message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] DocumentSectionManager: ${message}\n`;
        console.log(logMessage.trim());
        fs.appendFileSync(this.logFile, logMessage);
    }

    /**
     * Read and parse the document file
     */
    readDocument(): string {
        try {
            if (!fs.existsSync(this.documentPath)) {
                throw new Error(`Document file not found: ${this.documentPath}`);
            }
            const content = fs.readFileSync(this.documentPath, 'utf-8');
            this.log(`Successfully read document: ${this.documentPath}`);
            return content;
        } catch (error: any) {
            this.log(`Error reading document: ${error.message}`);
            throw error;
        }
    }

    /**
     * Identify and map all sections in the document
     */
    identifyDocumentSections(documentContent: string): Map<ContentType, SectionContent> {
        const sectionsMap = new Map<ContentType, SectionContent>();

        for (const [contentType, sectionConfig] of Object.entries(DOCUMENT_SECTIONS)) {
            const section = this.findSection(documentContent, contentType as ContentType, sectionConfig);
            if (section) {
                sectionsMap.set(contentType as ContentType, section);
                this.log(`Found section: ${contentType} at index ${section.startIndex}-${section.endIndex}`);
            }
        }

        return sectionsMap;
    }

    /**
     * Find a specific section in the document
     */
    private findSection(
        documentContent: string,
        contentType: ContentType,
        sectionConfig: DocumentSection
    ): SectionContent | null {
        const startIndex = documentContent.indexOf(sectionConfig.startMarker);
        if (startIndex === -1) {
            this.log(`Section not found: ${contentType} (${sectionConfig.startMarker})`);
            return null;
        }

        // Find end of section
        let endIndex: number;
        if (sectionConfig.endMarker) {
            // Look for specific end marker
            const endMarkerIndex = documentContent.indexOf(sectionConfig.endMarker, startIndex + sectionConfig.startMarker.length);
            endIndex = endMarkerIndex !== -1 ? endMarkerIndex : documentContent.length;
        } else {
            // Look for next major section (##)
            const nextSectionIndex = documentContent.indexOf('\n## ', startIndex + sectionConfig.startMarker.length);
            endIndex = nextSectionIndex !== -1 ? nextSectionIndex : documentContent.length;
        }

        const currentContent = documentContent.substring(startIndex, endIndex);
        
        // Handle subsections if they exist
        let subsectionIndices: { [key: string]: { startIndex: number; endIndex: number } } | undefined;
        if (sectionConfig.subsections) {
            subsectionIndices = {};
            for (const [subKey, subMarker] of Object.entries(sectionConfig.subsections)) {
                const subStartIndex = documentContent.indexOf(subMarker, startIndex);
                if (subStartIndex !== -1 && subStartIndex < endIndex) {
                    let subEndIndex: number;
                    // Find next subsection or end of main section
                    const nextSubIndex = this.findNextSubsectionIndex(documentContent, subStartIndex + subMarker.length, endIndex);
                    subEndIndex = nextSubIndex !== -1 ? nextSubIndex : endIndex;
                    
                    subsectionIndices[subKey] = {
                        startIndex: subStartIndex,
                        endIndex: subEndIndex
                    };
                }
            }
        }

        return {
            contentType,
            startIndex,
            endIndex,
            currentContent,
            hasSubsections: !!sectionConfig.subsections,
            subsectionIndices
        };
    }

    /**
     * Find the next subsection or main section index
     */
    private findNextSubsectionIndex(documentContent: string, fromIndex: number, maxIndex: number): number {
        const patterns = ['\n## ', '\n### '];
        let nearestIndex = maxIndex;

        for (const pattern of patterns) {
            const index = documentContent.indexOf(pattern, fromIndex);
            if (index !== -1 && index < nearestIndex && index < maxIndex) {
                nearestIndex = index;
            }
        }

        return nearestIndex === maxIndex ? -1 : nearestIndex;
    }

    /**
     * Update a specific section with new content
     */
    updateDocumentSection(
        documentContent: string,
        contentType: ContentType,
        newContent: string,
        targetSubsection?: string
    ): string {
        try {
            const sectionConfig = DOCUMENT_SECTIONS[contentType];
            if (!sectionConfig) {
                throw new Error(`No configuration found for content type: ${contentType}`);
            }

            const section = this.findSection(documentContent, contentType, sectionConfig);
            if (!section) {
                throw new Error(`Section not found for content type: ${contentType}`);
            }

            let updatedContent: string;

            if (targetSubsection && section.subsectionIndices && section.subsectionIndices[targetSubsection]) {
                // Update specific subsection
                updatedContent = this.updateSubsection(
                    documentContent,
                    section.subsectionIndices[targetSubsection],
                    newContent,
                    contentType,
                    targetSubsection
                );
            } else {
                // Update entire section
                updatedContent = this.updateEntireSection(documentContent, section, newContent, contentType);
            }

            this.log(`Successfully updated ${contentType} section${targetSubsection ? ` (${targetSubsection})` : ''}`);
            return updatedContent;

        } catch (error: any) {
            this.log(`Error updating section ${contentType}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update a specific subsection
     */
    private updateSubsection(
        documentContent: string,
        subsectionIndices: { startIndex: number; endIndex: number },
        newContent: string,
        contentType: ContentType,
        subsectionName: string
    ): string {
        const before = documentContent.substring(0, subsectionIndices.startIndex);
        const after = documentContent.substring(subsectionIndices.endIndex);
        
        // Get the subsection header
        const sectionConfig = DOCUMENT_SECTIONS[contentType];
        const subsectionHeader = sectionConfig.subsections?.[subsectionName] || '';
        
        const updatedSubsection = `${subsectionHeader}\n\n${newContent}\n`;
        
        return before + updatedSubsection + after;
    }

    /**
     * Update entire section
     */
    private updateEntireSection(
        documentContent: string,
        section: SectionContent,
        newContent: string,
        contentType: ContentType
    ): string {
        const before = documentContent.substring(0, section.startIndex);
        const after = documentContent.substring(section.endIndex);
        
        return before + newContent + after;
    }

    /**
     * Handle special blog section updates (Latest + Older posts)
     */
    updateBlogSections(documentContent: string, latestPosts: any[], olderPosts: any[]): string {
        try {
            this.log('Updating blog sections with latest and older posts...');
            
            const section = this.findSection(documentContent, 'blogs', DOCUMENT_SECTIONS.blogs);
            if (!section) {
                throw new Error('Blog section not found in document');
            }

            // Generate content for latest posts (first 10)
            const latestContent = this.generateBlogContent(latestPosts.slice(0, 10));
            this.log(`Processing ${Math.min(latestPosts.length, 10)} latest posts out of ${latestPosts.length} available`);
            
            // Generate content for ALL remaining older posts (no slice limit)
            const olderContent = this.generateBlogContent(olderPosts);
            this.log(`Processing ALL ${olderPosts.length} older posts (no limit applied)`);

            // Build the complete blog section
            const completeBlogSection = `## **IT Path Solutions – Blog Insights**

*Let's empower with knowledge and help businesses innovate through technological decisions.*

### **Latest Blog Posts**

${latestContent}

### **Older Posts (earlier entries)**

${olderContent}

*All available blog posts are listed above.* [https://www.itpathsolutions.com/blog/](https://www.itpathsolutions.com/blog/)

---

`;

            // Replace the entire blog section
            const before = documentContent.substring(0, section.startIndex);
            const after = documentContent.substring(section.endIndex);
            
            return before + completeBlogSection + after;

        } catch (error: any) {
            this.log(`Error updating blog sections: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate blog content for posts
     */
    private generateBlogContent(posts: any[]): string {
        let content = '';

        posts.forEach(async post => {
            const date = new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const authorId = post.author;
            let authorName = await this.wordpressService.fetchAuthor(authorId);

            // Clean and format the title
            const title = (post.title?.rendered || post.title || '').replace(/&#038;/g, '&');
            
            // Format the blog entry
            content += `-   **${title}**\n`;
            content += `    *Posted on ${date} by ${authorName}*\n`;
            if (post.link) {
                content += `    ${post.link}\n`;
            }
        });

        return content;
    }

    /**
     * Create backup of document before updating
     */
    createBackup(): string {
        try {
            const timestamp = Date.now();
            const backupPath = `${this.documentPath}.backup.${timestamp}`;
            
            if (fs.existsSync(this.documentPath)) {
                fs.copyFileSync(this.documentPath, backupPath);
                this.log(`Created backup: ${backupPath}`);
                return backupPath;
            }
            
            throw new Error('Original document not found for backup');
        } catch (error: any) {
            this.log(`Error creating backup: ${error.message}`);
            throw error;
        }
    }

    /**
     * Save updated content to document
     */
    saveDocument(content: string): void {
        try {
            // Create backup first
            this.createBackup();
            
            // Write updated content
            fs.writeFileSync(this.documentPath, content, 'utf-8');
            this.log(`Document saved successfully: ${this.documentPath}`);
        } catch (error: any) {
            this.log(`Error saving document: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate document structure
     */
    validateDocumentStructure(documentContent: string): {
        isValid: boolean;
        missingeSections: ContentType[];
        foundSections: ContentType[];
    } {
        const foundSections: ContentType[] = [];
        const missingSections: ContentType[] = [];

        for (const contentType of Object.keys(DOCUMENT_SECTIONS) as ContentType[]) {
            const sectionConfig = DOCUMENT_SECTIONS[contentType];
            const hasSection = documentContent.includes(sectionConfig.startMarker);
            
            if (hasSection) {
                foundSections.push(contentType);
            } else {
                missingSections.push(contentType);
            }
        }

        return {
            isValid: missingSections.length === 0,
            missingeSections: missingSections,
            foundSections: foundSections
        };
    }

    /**
     * Get section statistics
     */
    getSectionStatistics(documentContent: string): {
        [key in ContentType]?: {
            hasSection: boolean;
            contentLength: number;
            subsections: string[];
        };
    } {
        const stats: any = {};

        for (const [contentType, sectionConfig] of Object.entries(DOCUMENT_SECTIONS)) {
            const section = this.findSection(documentContent, contentType as ContentType, sectionConfig);
            
            stats[contentType] = {
                hasSection: !!section,
                contentLength: section?.currentContent.length || 0,
                subsections: section?.subsectionIndices ? Object.keys(section.subsectionIndices) : []
            };
        }

        return stats;
    }
}

export default DocumentSectionManager;
