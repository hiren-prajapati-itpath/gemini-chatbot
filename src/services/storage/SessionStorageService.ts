import { SessionContext, SerializableSessionContext } from '../../models/SessionContext.js';
import { ConversationMessage } from '../../models/ConversationMessage.js';

export interface SessionStorageService {
    // Session management
    saveSession(session: SessionContext): Promise<void>;
    getSession(sessionId: string): Promise<SessionContext | null>;
    deleteSession(sessionId: string): Promise<boolean>;
    listActiveSessions(): Promise<SessionContext[]>;
    
    // Message management
    saveMessage(message: ConversationMessage): Promise<void>;
    getSessionMessages(sessionId: string, limit?: number): Promise<ConversationMessage[]>;
    
    // Cleanup and maintenance
    cleanupInactiveSessions(maxInactiveHours: number): Promise<number>;
    
    // Health check
    isHealthy(): Promise<boolean>;
    
    // Optional: Batch operations for performance
    saveMessages?(messages: ConversationMessage[]): Promise<void>;
    updateSessionActivity?(sessionId: string, lastActivity: Date): Promise<void>;
}
