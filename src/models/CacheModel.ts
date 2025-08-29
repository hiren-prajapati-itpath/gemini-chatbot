import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// Define the attributes interface
export interface CacheAttributes {
    id: string;
    name: string;
    model: string;
    fileUri?: string;
    mimeType?: string;
    systemInstruction?: string;
    expireTime?: Date;
    cachedTokens: number;
    isActive: boolean;
    uploadedFileName?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

// Define the creation attributes (optional fields for creation)
export interface CacheCreationAttributes extends Optional<CacheAttributes, 'id' | 'isActive' | 'createdAt' | 'updatedAt'> {}

// Define the Cache model class
export class CacheModel extends Model<CacheAttributes, CacheCreationAttributes> implements CacheAttributes {
    public id!: string;
    public name!: string;
    public model!: string;
    public fileUri?: string;
    public mimeType?: string;
    public systemInstruction?: string;
    public expireTime?: Date;
    public cachedTokens!: number;
    public isActive!: boolean;
    public uploadedFileName?: string;
    public metadata?: Record<string, any>;
    public createdAt!: Date;
    public updatedAt!: Date;

    // Static method to initialize the model
    public static initModel(sequelize: Sequelize): typeof CacheModel {
        CacheModel.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    unique: true,
                },
                model: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                fileUri: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                mimeType: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                systemInstruction: {
                    type: DataTypes.TEXT,
                    allowNull: true,
                },
                expireTime: {
                    type: DataTypes.DATE,
                    allowNull: true,
                },
                cachedTokens: {
                    type: DataTypes.BIGINT,
                    allowNull: false,
                    defaultValue: 0,
                },
                isActive: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
                },
                uploadedFileName: {
                    type: DataTypes.STRING,
                    allowNull: true,
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
                tableName: 'caches',
                timestamps: true,
                indexes: [
                    {
                        unique: true,
                        fields: ['name']
                    },
                    {
                        fields: ['isActive']
                    },
                    {
                        fields: ['expireTime']
                    }
                ]
            }
        );

        return CacheModel;
    }
}
