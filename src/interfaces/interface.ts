// src/interfaces/interface.ts

export interface PaginationInfo {
	page: number;
	per_page: number;
	total: number;
	total_pages: number;
}

export interface APIResponse<T> {
	success: boolean;
	data?: T;
	pagination?: PaginationInfo;
	message?: string;
	error?: any;
}

export default APIResponse;
