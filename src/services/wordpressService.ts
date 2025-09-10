// src/services/wordpressService.ts
import axios, { AxiosResponse } from 'axios';
import { wpConfig } from '../config/wordpress.js';
import { APIResponse } from '../interfaces/interface.js';

export class WordPressService {
    private baseUrl: string;
    private auth: { username: string; password: string };

    constructor() {
        this.baseUrl = wpConfig.baseUrl;
        this.auth = wpConfig.auth;
    }

    async get<T>(endpoint: string, params?: any): Promise<APIResponse<T[]>> {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const response: AxiosResponse = await axios.get(url, {
                auth: this.auth,
                params: { ...params, _embed: true }
            });
            console.log("🚀 ~ WordPressService ~ get ~ url:", url)
            return {
                success: true,
                data: response.data,
                pagination: this.extractPagination(response.headers)
            };
        } catch (error: any) {
            return this.handleError(error);
        }
    }

    async getById<T>(endpoint: string, id: string): Promise<APIResponse<T>> {
        try {
            const url = `${this.baseUrl}${endpoint}/${id}`;
            const response: AxiosResponse = await axios.get(url, {
                auth: this.auth,
                params: { _embed: true }
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error: any) {
            return this.handleError(error);
        }
    }

    async post<T>(endpoint: string, data: any): Promise<APIResponse<T>> {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const response: AxiosResponse = await axios.post(url, data, {
                auth: this.auth
            });

            return {
                success: true,
                data: response.data,
                message: 'Created successfully'
            };
        } catch (error: any) {
            return this.handleError(error);
        }
    }

    async put<T>(endpoint: string, id: string, data: any): Promise<APIResponse<T>> {
        try {
            const url = `${this.baseUrl}${endpoint}/${id}`;
            const response: AxiosResponse = await axios.put(url, data, {
                auth: this.auth
            });

            return {
                success: true,
                data: response.data,
                message: 'Updated successfully'
            };
        } catch (error: any) {
            return this.handleError(error);
        }
    }

    async delete<T>(endpoint: string, id: string, force = false): Promise<APIResponse<T>> {
        try {
            const url = `${this.baseUrl}${endpoint}/${id}`;
            const response: AxiosResponse = await axios.delete(url, {
                auth: this.auth,
                params: { force }
            });

            return {
                success: true,
                data: response.data,
                message: force ? 'Permanently deleted' : 'Moved to trash'
            };
        } catch (error: any) {
            return this.handleError(error);
        }
    }

    private extractPagination(headers: any) {
        return {
            page: parseInt(headers['x-wp-page'] || '1'),
            per_page: parseInt(headers['x-wp-per-page'] || '10'),
            total: parseInt(headers['x-wp-total'] || '0'),
            total_pages: parseInt(headers['x-wp-totalpages'] || '1')
        };
    }

    private handleError(error: any): APIResponse<never> {
        console.error('WordPress API Error:', error.response?.data || error.message);

        return {
            success: false,
            error: error.response?.data?.message || error.message || 'API Error'
        };
    }

    /**
     * Fetch author name by ID with caching
     */
    async fetchAuthor(authorId: number): Promise<string> {
        try {
            const response = await axios.get(
                `${this.baseUrl}/users/${authorId}`,
                {
                    auth: this.auth,
                    timeout: 5000
                }
            );

            const authorName = response.data?.name || "IT Path Solutions";
            return authorName;
        } catch (error) {
            console.warn(`Failed to fetch author ${authorId}:`, error instanceof Error ? error.message : 'Unknown error');
            return "IT Path Solutions";
        }
    }
}