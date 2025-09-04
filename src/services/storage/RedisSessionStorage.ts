import Redis from 'ioredis';
import { SessionStorageService } from './SessionStorageService.js';
import { SessionContext, SerializableSessionContext } from '../../models/SessionContext.js';
import { ConversationMessage } from '../../models/ConversationMessage.js';

export class RedisSessionStorage implements SessionStorageService {
    private redis: Redis;

    constructor(redisUrl?: string) {
        const connectionString = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
        this.redis = new Redis(connectionString, {
            enableReadyCheck: false,
            maxRetriesPerRequest: 3,
            lazyConnect: true
        });

        this.redis.on('error', (error: Error) => {
            console.error('Redis connection error:', error);
        });

        this.redis.on('connect', () => {
            console.log('✅ Redis connected for session storage');
        });
    }

    async saveSession(session: SessionContext): Promise<void> {
        try {
            // Convert to serializable format (exclude geminiChat object)
            const serializableSession: SerializableSessionContext = {
                sessionId: session.sessionId,
                createdAt: session.createdAt,
                lastActivity: session.lastActivity,
                messageCount: session.messageCount,
                chatConfig: {
                    model: 'gemini-2.0-flash-001', // Will be passed from caller
                    cachedContent: 'cache-name', // Will be passed from caller
                    temperature: 0.7
                }
            };

            const key = `session:${session.sessionId}`;
            const ttlSeconds = 24 * 60 * 60; // 24 hours

            await this.redis.setex(
                key,
                ttlSeconds,
                JSON.stringify(serializableSession, this.dateReplacer)
            );

            console.log(`💾 Redis: Saved session ${session.sessionId}`);
        } catch (error) {
            console.error(`❌ Redis: Failed to save session ${session.sessionId}:`, error);
            throw error;
        }
    }

    async getSession(sessionId: string): Promise<SessionContext | null> {
        try {
            const key = `session:${sessionId}`;
            const data = await this.redis.get(key);
            
            if (!data) {
                return null;
            }

            const serializableSession: SerializableSessionContext = JSON.parse(data, this.dateReviver);
            
            // Note: geminiChat will need to be recreated by the caller
            // This returns a partial SessionContext - the caller must restore geminiChat
            return {
                sessionId: serializableSession.sessionId,
                geminiChat: null, // Will be restored by caller
                createdAt: serializableSession.createdAt,
                lastActivity: serializableSession.lastActivity,
                messageCount: serializableSession.messageCount
            };
        } catch (error) {
            console.error(`❌ Redis: Failed to get session ${sessionId}:`, error);
            return null;
        }
    }

    async deleteSession(sessionId: string): Promise<boolean> {
        try {
            const sessionKey = `session:${sessionId}`;
            const messagesKey = `messages:${sessionId}`;
            
            // Delete both session and its messages
            const deletedCount = await this.redis.del(sessionKey, messagesKey);
            
            console.log(`🗑️ Redis: Deleted session ${sessionId} (${deletedCount} keys removed)`);
            return deletedCount > 0;
        } catch (error) {
            console.error(`❌ Redis: Failed to delete session ${sessionId}:`, error);
            return false;
        }
    }

    async listActiveSessions(): Promise<SessionContext[]> {
        try {
            const pattern = 'session:*';
            const keys = await this.redis.keys(pattern);
            
            if (keys.length === 0) {
                return [];
            }

            const pipeline = this.redis.pipeline();
            keys.forEach((key: string) => pipeline.get(key));
            const results = await pipeline.exec();

            const sessions: SessionContext[] = [];
            
            if (results) {
                for (let i = 0; i < results.length; i++) {
                    const [error, data] = results[i];
                    if (!error && data) {
                        try {
                            const serializableSession: SerializableSessionContext = JSON.parse(data as string, this.dateReviver);
                            sessions.push({
                                sessionId: serializableSession.sessionId,
                                geminiChat: null, // Will be restored by caller if needed
                                createdAt: serializableSession.createdAt,
                                lastActivity: serializableSession.lastActivity,
                                messageCount: serializableSession.messageCount
                            });
                        } catch (parseError) {
                            console.warn(`⚠️ Redis: Failed to parse session data for key ${keys[i]}:`, parseError);
                        }
                    }
                }
            }

            return sessions;
        } catch (error) {
            console.error('❌ Redis: Failed to list active sessions:', error);
            return [];
        }
    }

    async saveMessage(message: ConversationMessage): Promise<void> {
        try {
            const key = `messages:${message.sessionId}`;
            const messageData = JSON.stringify(message, this.dateReplacer);
            
            // Use LPUSH to add to beginning of list (newest first)
            await this.redis.lpush(key, messageData);
            
            // Set TTL on the message list (24 hours)
            await this.redis.expire(key, 24 * 60 * 60);
            
            // Optional: Limit message history to prevent memory bloat
            // Keep only last 1000 messages per session
            await this.redis.ltrim(key, 0, 999);
            
        } catch (error) {
            console.error(`❌ Redis: Failed to save message for session ${message.sessionId}:`, error);
            throw error;
        }
    }

    async saveMessages(messages: ConversationMessage[]): Promise<void> {
        if (messages.length === 0) return;

        try {
            const pipeline = this.redis.pipeline();
            
            // Group messages by session
            const messagesBySession = new Map<string, ConversationMessage[]>();
            messages.forEach(msg => {
                if (!messagesBySession.has(msg.sessionId)) {
                    messagesBySession.set(msg.sessionId, []);
                }
                messagesBySession.get(msg.sessionId)!.push(msg);
            });

            // Batch save by session
            for (const [sessionId, sessionMessages] of messagesBySession) {
                const key = `messages:${sessionId}`;
                const serializedMessages = sessionMessages.map(msg => 
                    JSON.stringify(msg, this.dateReplacer)
                );
                
                pipeline.lpush(key, ...serializedMessages);
                pipeline.expire(key, 24 * 60 * 60);
                pipeline.ltrim(key, 0, 999);
            }

            await pipeline.exec();
            console.log(`💾 Redis: Batch saved ${messages.length} messages across ${messagesBySession.size} sessions`);
        } catch (error) {
            console.error('❌ Redis: Failed to batch save messages:', error);
            throw error;
        }
    }

    async getSessionMessages(sessionId: string, limit: number = 100): Promise<ConversationMessage[]> {
        try {
            const key = `messages:${sessionId}`;
            
            // Get messages in reverse chronological order (newest first)
            const messageData = await this.redis.lrange(key, 0, limit - 1);
            
            const messages: ConversationMessage[] = [];
            for (const data of messageData) {
                try {
                    const message: ConversationMessage = JSON.parse(data, this.dateReviver);
                    messages.push(message);
                } catch (parseError) {
                    console.warn(`⚠️ Redis: Failed to parse message data for session ${sessionId}:`, parseError);
                }
            }

            // Reverse to get chronological order (oldest first)
            return messages.reverse();
        } catch (error) {
            console.error(`❌ Redis: Failed to get messages for session ${sessionId}:`, error);
            return [];
        }
    }

    async updateSessionActivity(sessionId: string, lastActivity: Date): Promise<void> {
        try {
            const key = `session:${sessionId}`;
            const sessionData = await this.redis.get(key);
            
            if (sessionData) {
                const session: SerializableSessionContext = JSON.parse(sessionData, this.dateReviver);
                session.lastActivity = lastActivity;
                
                const ttlSeconds = 24 * 60 * 60; // Reset TTL
                await this.redis.setex(
                    key,
                    ttlSeconds,
                    JSON.stringify(session, this.dateReplacer)
                );
            }
        } catch (error) {
            console.error(`❌ Redis: Failed to update session activity for ${sessionId}:`, error);
        }
    }

    async cleanupInactiveSessions(maxInactiveHours: number): Promise<number> {
        try {
            const cutoffTime = new Date(Date.now() - (maxInactiveHours * 60 * 60 * 1000));
            const sessions = await this.listActiveSessions();
            
            let cleanedCount = 0;
            const pipeline = this.redis.pipeline();
            
            for (const session of sessions) {
                if (session.lastActivity < cutoffTime) {
                    pipeline.del(`session:${session.sessionId}`);
                    pipeline.del(`messages:${session.sessionId}`);
                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
                await pipeline.exec();
                console.log(`🧹 Redis: Cleaned up ${cleanedCount} inactive sessions`);
            }

            return cleanedCount;
        } catch (error) {
            console.error('❌ Redis: Failed to cleanup inactive sessions:', error);
            return 0;
        }
    }

    async isHealthy(): Promise<boolean> {
        try {
            const result = await this.redis.ping();
            return result === 'PONG';
        } catch (error) {
            console.error('❌ Redis health check failed:', error);
            return false;
        }
    }

    // Helper methods for JSON serialization of Dates
    private dateReplacer(key: string, value: any): any {
        if (value instanceof Date) {
            return { __type: 'Date', value: value.toISOString() };
        }
        return value;
    }

    private dateReviver(key: string, value: any): any {
        if (value && typeof value === 'object' && value.__type === 'Date') {
            return new Date(value.value);
        }
        return value;
    }

    // Cleanup method for graceful shutdown
    async disconnect(): Promise<void> {
        try {
            await this.redis.disconnect();
            console.log('✅ Redis disconnected');
        } catch (error) {
            console.error('❌ Redis disconnect error:', error);
        }
    }
}
