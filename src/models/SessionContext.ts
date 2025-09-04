export interface SessionContext {
    sessionId: string;
    geminiChat: any; // Gemini Chat object (can't be serialized)
    createdAt: Date;
    lastActivity: Date;
    messageCount: number;
}

// Serializable version for storage (without geminiChat object)
export interface SerializableSessionContext {
    sessionId: string;
    createdAt: Date;
    lastActivity: Date;
    messageCount: number;
    // Store chat configuration to recreate geminiChat
    chatConfig?: {
        model: string;
        cachedContent: string;
        temperature?: number;
    };
}
