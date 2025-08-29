import { Sequelize, Options } from 'sequelize';
import { CacheModel } from '../models/CacheModel.js';

// Lazy initialization - create sequelize instance only when needed
let sequelize: Sequelize | null = null;

// Environment-based database configuration
const getDatabaseConfig = (): Options => {
    // Ensure all values are properly converted to strings and trimmed
    const dbName = String(process.env.DB_NAME || 'gemini_cache_db').trim();
    const dbUser = String(process.env.DB_USER || 'postgres').trim();
    const dbPassword = String(process.env.DB_PASSWORD || '').trim();
    const dbHost = String(process.env.DB_HOST || 'localhost').trim();
    const dbPort = parseInt(process.env.DB_PORT || '5432');

    // Additional validation and type safety
    if (!dbPassword) {
        throw new Error('Database password is required');
    }

    const config: Options = {
        dialect: 'postgres',
        host: dbHost,
        port: dbPort,
        database: dbName,
        username: dbUser,
        password: dbPassword,
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        dialectOptions: {
            ssl: process.env.NODE_ENV === 'production' || 
                 dbHost.includes('supabase.co') || 
                 dbHost.includes('prisma.io') ? {
                require: true,
                rejectUnauthorized: false,
            } : false,
        },
    };

    return config;
};

const getSequelizeInstance = () => {
    if (!sequelize) {
        const config = getDatabaseConfig();
        
        // Create sequelize instance using the config object approach
        sequelize = new Sequelize(config);
    }
    return sequelize;
};
export const initializeDatabase = async () => {
    try {
        // Validate required environment variables first
        const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Additional validation for password
        const password = String(process.env.DB_PASSWORD || '').trim();
        if (!password) {
            throw new Error('DB_PASSWORD cannot be empty');
        }

        console.log('🔍 Database connection config:', {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || '5432',
            username: process.env.DB_USER,
            database: process.env.DB_NAME,
            passwordProvided: !!process.env.DB_PASSWORD,
            passwordLength: password.length,
            ssl: !!(process.env.NODE_ENV === 'production' || 
                   process.env.DB_HOST?.includes('supabase.co') || 
                   process.env.DB_HOST?.includes('prisma.io'))
        });

        // Get the sequelize instance (this will create it with the config)
        const db = getSequelizeInstance();

        // Test the connection
        await db.authenticate();
        console.log('✅ Database connected successfully');

        // Initialize models
        CacheModel.initModel(db);

        // Sync database (creates tables if they don't exist)
        await db.sync({ alter: true });
        console.log('✅ Database synchronized');

        return db;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        
        // Reset sequelize instance on failure so it can be recreated
        sequelize = null;
        
        throw error;
    }
};

export const closeDatabase = async () => {
    try {
        if (sequelize) {
            await sequelize.close();
            console.log('✅ Database connection closed');
        }
    } catch (error) {
        console.error('❌ Error closing database:', error);
    }
};
