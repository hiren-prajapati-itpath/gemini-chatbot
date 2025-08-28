import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('caches')
export class CacheEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ unique: true })
    name!: string;

    @Column()
    model!: string;

    @Column({ nullable: true })
    fileUri?: string;

    @Column({ nullable: true })
    mimeType?: string;

    @Column({ type: 'text', nullable: true })
    systemInstruction?: string;

    @Column({ type: 'timestamptz', nullable: true })
    expireTime?: Date;

    @Column({ type: 'bigint', default: 0 })
    cachedTokens!: number;

    @Column({ default: true })
    isActive!: boolean;

    @Column({ nullable: true })
    uploadedFileName?: string;

    @Column({ type: 'json', nullable: true })
    metadata?: Record<string, any>;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
