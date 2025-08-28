import { DataSource } from 'typeorm';
import { CacheEntity } from '../entities/CacheEntity.js';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'ips12345',
    database: process.env.DB_NAME || 'gemini_cache_db',
    synchronize: true, // Set to false in production
    logging: process.env.NODE_ENV === 'development',
    entities: [CacheEntity],
    migrations: ['src/migrations/*.ts'],
    subscribers: ['src/subscribers/*.ts'],
});

export const initializeDatabase = async () => {
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log('✅ Database connected successfully');
        }
        return AppDataSource;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
};

export const closeDatabase = async () => {
    try {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log('✅ Database connection closed');
        }
    } catch (error) {
        console.error('❌ Error closing database:', error);
    }
};
