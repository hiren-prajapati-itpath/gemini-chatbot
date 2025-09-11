// src/config/syncConfig.ts
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env') });

console.log('Loaded WP_BASE_URL:', process.env.WP_BASE_URL);
console.log('Loaded DOCUMENT_PATH:', process.env.DOCUMENT_PATH);

export interface SyncConfig {
    wordpress: {
        baseUrl: string;
        username: string;
        password: string;
        graphqlUrl: string;
        apiType: 'rest' | 'graphql';
    };
    sync: {
        enableAutoSync: boolean;
        interval: string;
        documentPath: string;
        backupDirectory: string;
        logFile: string;
        maxRetries: number;
        retryDelay: number;
        syncDirection: 'wp-to-doc';
    };
    contentTypes: {
        [key: string]: {
            enabled: boolean;
            priority: number;
        };
    };
    reporting: {
        enableReports: boolean;
        reportDirectory: string;
        reportFormats: string[];
    };
}

export const syncConfig: SyncConfig = {
    wordpress: {
        baseUrl: process.env.WP_BASE_URL || 'https://itpathadmin.project-demo.info/wp-json/wp/v2',
        username: process.env.WP_USERNAME || '',
        password: process.env.WP_PASSWORD || '',
        graphqlUrl: process.env.WP_GRAPHQL_URL || 'https://itpathadmin.project-demo.info/graphql',
        apiType: (process.env.WP_API_TYPE as 'rest' | 'graphql') || 'rest'
    },
    sync: {
        enableAutoSync: process.env.ENABLE_AUTO_SYNC === 'true',
        interval: process.env.SYNC_INTERVAL || '0 */6 * * *', // Every 6 hours
        documentPath: path.join(process.cwd(), process.env.DOCUMENT_PATH || './IT-Path-Solutions-Blogs.md'),
        backupDirectory: process.env.BACKUP_DIRECTORY || './backups',
        logFile: process.env.SYNC_LOG_FILE || './universal-sync.log',
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.RETRY_DELAY || '5000'), // 5 seconds
        syncDirection: 'wp-to-doc'
    },
    contentTypes: {
        blogs: {
            enabled: process.env.SYNC_BLOGS !== 'false',
            priority: 1
        },
        solutions: {
            enabled: process.env.SYNC_SOLUTIONS !== 'false',
            priority: 2
        },
        caseStudies: {
            enabled: process.env.SYNC_CASE_STUDIES !== 'false',
            priority: 3
        },
        portfolio: {
            enabled: process.env.SYNC_PORTFOLIO !== 'false',
            priority: 4
        },
        careers: {
            enabled: process.env.SYNC_CAREERS !== 'false',
            priority: 5
        }
    },
    reporting: {
        enableReports: process.env.ENABLE_REPORTS === 'true',
        reportDirectory: process.env.REPORT_DIRECTORY || './reports',
        reportFormats: (process.env.REPORT_FORMATS || 'json,docx').split(',')
    }
};

// Content type templates for document generation
export const documentTemplates = {
    blogs: {
        sectionTitle: '## **IT Path Solutions – Blog Insights**',
        introduction: '*Let\'s empower with knowledge and help businesses innovate through technological decisions.*',
        itemTemplate: (item: any) => {
            const date = new Date(item.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long', 
                day: 'numeric'
            });
            
            // Enhanced author name extraction matching DocumentSectionManager logic
            let authorName = item.author?.name || 
                           item._embedded?.author?.[0]?.name || 
                           item.author_name;
            
            // If no author name found but we have an author ID, use fallback
            if (!authorName && (item.author || item.author_id)) {
                const authorId = item.author || item.author_id;
                authorName = typeof authorId === 'number' ? `Author ID: ${authorId}` : 'IT Path Solutions';
            }
            
            // Final fallback
            if (!authorName) {
                authorName = 'IT Path Solutions';
            }
            
            const title = (item.title?.rendered || item.title || '').replace(/&#038;/g, '&');
            
            return `-   **${title}**
    *Posted on ${date} by ${authorName}*
    ${item.link || ''}`;
        }
    },
    solutions: {
        sectionTitle: '## **IT Path Solutions – Solutions Overview**',
        introduction: '*Showcasing a selection of custom-tailored app solutions across diverse industry and business verticals. (https://www.itpathsolutions.com/solutions/)*',
        itemTemplate: (item: any) => {
            const title = (item.title?.rendered || item.title || '').replace(/&#038;/g, '&');
            
            // Get description from various sources
            let description = item.description || 
                            item.content?.rendered || 
                            item.excerpt?.rendered || 
                            item.acf?.description ||
                            item.customFields?.description || 
                            '';
            
            // Clean HTML and get meaningful content
            description = description.replace(/<[^>]*>/g, '').trim();
            
            // If description is too short or generic, provide a fallback
            if (!description || description.length < 10 || description === 'new one' || description === 'new one test') {
                description = `A comprehensive ${title.toLowerCase()} solution designed to meet specific business requirements`;
            }
            
            // Limit to reasonable length
            if (description.length > 200) {
                description = description.substring(0, 200) + '...';
            }
            
            const category = item.category || item.customFields?.category || 'General';
            const link = item.link || item.customFields?.url || '';
            
            return `* **${title}** (${category})
   ${description}
${link ? `   (${link})` : ''}`;
        }
    },
    caseStudies: {
        sectionTitle: '## **IT Path Solutions – Case Studies**',
        introduction: '*Real-world projects showcasing our expertise and client success stories.*',
        itemTemplate: (item: any) => {
            const title = (item.title?.rendered || item.title || '').replace(/&#038;/g, '&');
            const clientName = item.client_name || item.customFields?.clientName || 'Confidential Client';
            const industry = item.industry || item.customFields?.industry || 'Various';
            const description = item.description || item.content?.rendered || item.excerpt?.rendered || '';
            
            return `### **${title}**
*Client: ${clientName}*
*Industry: ${industry}*

${description.replace(/<[^>]*>/g, '').substring(0, 300)}...`;
        }
    },
    portfolio: {
        sectionTitle: '## **IT Path Solutions – Portfolio**',
        introduction: '**Overview:** A showcase of noteworthy works developed by IT Path Solutions across various technologies and industry verticals. (https://www.itpathsolutions.com/portfolio/)',
        itemTemplate: (item: any) => {
            const title = (item.title?.rendered || item.title || '').replace(/&#038;/g, '&');
            const projectName = item.project_name || item.customFields?.projectName || title;
            const category = item.category || item.customFields?.category || 'Development';
            const link = item.project_url || item.customFields?.projectUrl || item.link || '';
            
            return `**${projectName}** – ${link ? `[${link}](${link})` : 'Internal Project'}`;
        }
    },
    careers: {
        sectionTitle: '## **IT Path Solutions – Careers**',
        introduction: '*Is this chair for you? We are hiring, we need you.*',
        itemTemplate: (item: any) => {
            const title = (item.title?.rendered || item.title || '').replace(/&#038;/g, '&');
            const link = item.link
            // Extract data from ACF (Advanced Custom Fields) object
            const acf = item.acf || {};
            const experience = acf.experience || 'Not specified';
            const openings = acf.no_of_openings || '1';
            const location = acf.location || 'Remote';
            const isUrgent = acf.is_urgent || false;
            
            // Clean HTML from responsibilities and required skills
            let responsibilities = acf.key_responsibilities || '';
            let requiredSkills = acf.required_skills || '';
            
            // Strip HTML tags and format responsibilities
            responsibilities = responsibilities.replace(/<[^>]*>/g, '').replace(/\r\n/g, ' ').trim();
            requiredSkills = requiredSkills.replace(/<[^>]*>/g, '').replace(/\r\n/g, ' ').trim();


            return `* **${title}** (${link})

  * **Location:** ${location}
  * **Experience:** ${experience}
  * **Number of Openings:** ${openings}${isUrgent ? ' (Urgent Hiring)' : ''}

  * **Key Responsibilities:**
    ${responsibilities || 'Details available on application'}

  * **Required Skills:**
    ${requiredSkills || 'Details available on application'}`;
        }
    },
};

export default syncConfig;
