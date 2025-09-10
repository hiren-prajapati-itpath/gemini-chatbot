import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// Define the attributes interface
export interface SyncMetadataAttributes {
    id: string;
    contentType: string;
    lastSyncedAt: Date;
    lastModified: Date;
    totalItems: number;
    syncedItems: number;
    failedItems: number;
    syncStatus: 'success' | 'partial' | 'failed' | 'in_progress';
    errorLog?: string;
    syncDuration?: number; // in milliseconds
    apiEndpoint: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

// Define the creation attributes (optional fields for creation)
export interface SyncMetadataCreationAttributes extends Optional<SyncMetadataAttributes, 'id' | 'syncStatus' | 'totalItems' | 'syncedItems' | 'failedItems' | 'createdAt' | 'updatedAt'> {}

// Define the SyncMetadata model class
export class SyncMetadataModel extends Model<SyncMetadataAttributes, SyncMetadataCreationAttributes> implements SyncMetadataAttributes {
    public id!: string;
    public contentType!: string;
    public lastSyncedAt!: Date;
    public lastModified!: Date;
    public totalItems!: number;
    public syncedItems!: number;
    public failedItems!: number;
    public syncStatus!: 'success' | 'partial' | 'failed' | 'in_progress';
    public errorLog?: string;
    public syncDuration?: number;
    public apiEndpoint!: string;
    public metadata?: Record<string, any>;
    public createdAt!: Date;
    public updatedAt!: Date;

    // Static method to initialize the model
    public static initModel(sequelize: Sequelize): typeof SyncMetadataModel {
        SyncMetadataModel.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                },
                contentType: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    
                },
                lastSyncedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },
                lastModified: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },
                totalItems: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
                syncedItems: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
                failedItems: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                },
                syncStatus: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    defaultValue: 'in_progress',
                },
                errorLog: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                },
                syncDuration: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
                apiEndpoint: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                metadata: {
                    type: DataTypes.JSONB,
                    allowNull: true,
                },
                createdAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },
                updatedAt: {
                    type: DataTypes.DATE,
                    allowNull: false,
                }
            },
            {
                sequelize,
                tableName: 'sync_metadata',
                timestamps: true,
            }
        );

        return SyncMetadataModel;
    }

    // Instance methods for common operations
    public async markSyncInProgress(): Promise<void> {
        this.syncStatus = 'in_progress';
        this.lastModified = new Date();
        await this.save();
    }

    public async markSyncComplete(totalItems: number, syncedItems: number, failedItems: number, duration: number): Promise<void> {
        this.syncStatus = failedItems === 0 ? 'success' : (syncedItems > 0 ? 'partial' : 'failed');
        this.totalItems = totalItems;
        this.syncedItems = syncedItems;
        this.failedItems = failedItems;
        this.syncDuration = duration;
        this.lastSyncedAt = new Date();
        this.lastModified = new Date();
        await this.save();
    }

    public async logError(error: string): Promise<void> {
        this.errorLog = this.errorLog ? `${this.errorLog}\n\n--- ${new Date().toISOString()} ---\n${error}` : error;
        this.lastModified = new Date();
        await this.save();
    }

    // Static methods for querying
    public static async getLastSyncTime(contentType: string): Promise<Date | null> {
        const metadata = await SyncMetadataModel.findOne({
            where: { contentType },
            order: [['lastSyncedAt', 'DESC']]
        });
        return metadata?.lastSyncedAt || null;
    }

    public static async initializeContentType(contentType: string, apiEndpoint: string): Promise<SyncMetadataModel> {
        const [metadata] = await SyncMetadataModel.findOrCreate({
            where: { contentType },
            defaults: {
                contentType,
                apiEndpoint,
                lastSyncedAt: new Date('1970-01-01'), // Start from epoch for initial sync
                lastModified: new Date(),
                totalItems: 0,
                syncedItems: 0,
                failedItems: 0,
                syncStatus: 'success'
            }
        });
        return metadata;
    }

    public static async getAllSyncStatus(): Promise<SyncMetadataModel[]> {
        return await SyncMetadataModel.findAll({
            order: [['lastSyncedAt', 'DESC']]
        });
    }
}
