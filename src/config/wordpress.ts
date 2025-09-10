// src/config/wordpress.ts
import { syncConfig } from './syncConfig.js';

export const wpConfig = {
    baseUrl: syncConfig.wordpress.baseUrl,
    auth: {
        username: process.env.WP_USERNAME || '',
        password: process.env.WP_PASSWORD || ''
    },
};

// Custom post types for WordPress (you'll need to register these in WordPress)
export const customPostTypes = {
    solutions: 'solutions',
    caseStudies: 'case_studies',
    portfolio: 'portfolio',
    careers: 'job_opening',
    testimonials: 'testimonials'
};

// Content type configurations for sync
export const contentTypeConfigs = {
    blogs: {
        endpoint: '/posts',
        customPostType: false,
        documentSection: '## **IT Path Solutions -- Blog Insights**',
        fields: ['title', 'status', 'date', 'author', 'categories', 'tags', 'slug']
    },
    solutions: {
        endpoint: '/solutions',
        customPostType: true,
        documentSection: '## **Our Solutions**',
        fields: ['title', 'description', 'category', 'features', 'technologies', 'url', 'image', 'status']
    },
    caseStudies: {
        endpoint: '/case_studies',
        customPostType: true,
        documentSection: '## **Case Studies**',
        fields: ['title', 'client_name', 'industry', 'description', 'challenge', 'solution', 'results', 'technologies', 'project_duration', 'team_size']
    },
    portfolio: {
        endpoint: '/portfolio',
        customPostType: true,
        documentSection: '## **Portfolio**',
        fields: ['project_name', 'description', 'category', 'technologies', 'client', 'project_url', 'github_url', 'completion_date', 'status']
    },
    careers: {
        endpoint: '/job_opening',
        customPostType: true,
        documentSection: '## **Career Opportunities**',
        fields: ['job_title', 'department', 'experience_required', 'location', 'job_type', 'description', 'responsibilities', 'requirements', 'skills', 'salary_range', 'openings']
    },
    testimonials: {
        endpoint: '/testimonials',
        customPostType: true,
        documentSection: '## **Client Testimonials**',
        fields: ['client_name', 'company', 'position', 'testimonial', 'rating', 'project_type', 'location', 'featured', 'status']
    }
};

// GraphQL queries for different content types
export const graphqlQueries = {
    blogs: `
        query Blogs {
            posts {
                nodes {
                    id
                    title
                    content
                    excerpt
                    date
                    slug
                    link
                    categories {
                        nodes {
                            name
                        }
                    }
                    tags {
                        nodes {
                            name
                        }
                    }
                    author {
                        node {
                            name
                        }
                    }
                }
            }
        }
    `,
    solutions: `
        query SolutionDetail{
            solutions{
                nodes{
                    title
                    content
                    excerpt
                    uri
                }
            }
        }
    `,
    caseStudies: `
        query CaseStudies {
            caseStudies {
                nodes {
                    id
                    title
                    content
                    customFields {
                        clientName
                        industry
                        description
                        challenge
                        solution
                        results
                        technologies
                        projectDuration
                        teamSize
                    }
                }
            }
        }
    `,
    portfolio: `
        query Portfolio {
            portfolioItems {
                nodes {
                    id
                    title
                    content
                    customFields {
                        projectName
                        description
                        category
                        technologies
                        client
                        projectUrl
                        githubUrl
                        completionDate
                        status
                    }
                }
            }
        }
    `,
    careers: `
        query jobs{
            jobs{
                nodes{
                    title
                    slug
        jobOpenings
        {
        location
		experience
		requiredSkills
		noOfOpenings
		keyResponsibilities
        isUrgent
     }
    }
  }
}`,
    testimonials: `
        query Testimonials {
            testimonials {
                nodes {
                    id
                    title
                    content
                    customFields {
                        clientName
                        company
                        position
                        testimonial
                        rating
                        projectType
                        location
                        featured
                        status
                    }
                }
            }
        }
    `
};