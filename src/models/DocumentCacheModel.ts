import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// Document cache tracking for invalidation
export interface DocumentCacheAttributes {
    id: string;
    documentPath: string;
    documentHash: string;
    lastModified: Date;
    cacheId: string;
    isValid: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface DocumentCacheCreationAttributes extends Optional<DocumentCacheAttributes, 'id' | 'isValid' | 'createdAt' | 'updatedAt'> {}

export class DocumentCacheModel extends Model<DocumentCacheAttributes, DocumentCacheCreationAttributes> implements DocumentCacheAttributes {
    public id!: string;
    public documentPath!: string;
    public documentHash!: string;
    public lastModified!: Date;
    public cacheId!: string;
    public isValid!: boolean;
    public createdAt!: Date;
    public updatedAt!: Date;

    public static initModel(sequelize: Sequelize): typeof DocumentCacheModel {
        DocumentCacheModel.init(
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                },
                documentPath: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                documentHash: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                lastModified: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },
                cacheId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                },
                isValid: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
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
                tableName: 'document_caches',
                timestamps: true,
                indexes: [
                    {
                        fields: ['documentPath']
                    },
                    {
                        fields: ['cacheId']
                    },
                    {
                        fields: ['isValid']
                    },
                    {
                        fields: ['documentHash']
                    }
                ]
            }
        );

        return DocumentCacheModel;
    }
}
