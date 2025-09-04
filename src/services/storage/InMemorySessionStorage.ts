import { SessionStorageService } from './SessionStorageService.js';
import { SessionContext } from '../../models/SessionContext.js';
import { ConversationMessage } from '../../models/ConversationMessage.js';

export class InMemorySessionStorage implements SessionStorageService {
    private sessions: Map<string, SessionContext> = new Map();
    private messages: Map<string, ConversationMessage[]> = new Map();

    constructor() {
        console.log('📝 Using in-memory session storage (development mode)');
    }

    async saveSession(session: SessionContext): Promise<void> {
        this.sessions.set(session.sessionId, {
            ...session,
            lastActivity: new Date() // Update activity timestamp
        });
        console.log(`💾 Memory: Saved session ${session.sessionId}`);
    }

    async getSession(sessionId: string): Promise<SessionContext | null> {
        const session = this.sessions.get(sessionId);
        return session || null;
    }

    async deleteSession(sessionId: string): Promise<boolean> {
        const deleted = this.sessions.delete(sessionId);
        this.messages.delete(sessionId); // Also delete messages
        
        if (deleted) {
            console.log(`🗑️ Memory: Deleted session ${sessionId}`);
        }
        return deleted;
    }

    async listActiveSessions(): Promise<SessionContext[]> {
        return Array.from(this.sessions.values());
    }

    async saveMessage(message: ConversationMessage): Promise<void> {
        if (!this.messages.has(message.sessionId)) {
            this.messages.set(message.sessionId, []);
        }
        
        const sessionMessages = this.messages.get(message.sessionId)!;
        sessionMessages.push({ ...message });
        
        // Optional: Limit message history
        if (sessionMessages.length > 1000) {
            sessionMessages.splice(0, sessionMessages.length - 1000);
        }
    }

    async saveMessages(messages: ConversationMessage[]): Promise<void> {
        for (const message of messages) {
            await this.saveMessage(message);
        }
        console.log(`💾 Memory: Batch saved ${messages.length} messages`);
    }

    async getSessionMessages(sessionId: string, limit: number = 100): Promise<ConversationMessage[]> {
        const sessionMessages = this.messages.get(sessionId) || [];
        
        // Return last N messages (most recent)
        const startIndex = Math.max(0, sessionMessages.length - limit);
        return sessionMessages.slice(startIndex);
    }

    async updateSessionActivity(sessionId: string, lastActivity: Date): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = lastActivity;
        }
    }

    async cleanupInactiveSessions(maxInactiveHours: number): Promise<number> {
        const cutoffTime = new Date(Date.now() - (maxInactiveHours * 60 * 60 * 1000));
        let cleanedCount = 0;
        
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.lastActivity < cutoffTime) {
                this.sessions.delete(sessionId);
                this.messages.delete(sessionId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Memory: Cleaned up ${cleanedCount} inactive sessions`);
        }
        
        return cleanedCount;
    }

    async isHealthy(): Promise<boolean> {
        return true; // In-memory storage is always "healthy"
    }

    // Additional helper methods for development
    getStats(): { totalSessions: number; totalMessages: number } {
        const totalMessages = Array.from(this.messages.values())
            .reduce((sum, msgs) => sum + msgs.length, 0);
        
        return {
            totalSessions: this.sessions.size,
            totalMessages
        };
    }

    clearAll(): void {
        this.sessions.clear();
        this.messages.clear();
        console.log('🧹 Memory: Cleared all sessions and messages');
    }
}
