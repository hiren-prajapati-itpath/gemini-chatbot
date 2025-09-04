export interface ConversationMessage {
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    messageIndex?: number;
    tokenUsage?: {
        promptTokens?: number;
        responseTokens?: number;
        cachedTokens?: number;
        billedInputTokens?: number;
        totalTokens?: number;
        estimated?: boolean;
    };
}
