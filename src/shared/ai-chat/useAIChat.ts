import { useState, useCallback } from 'react';

export type AIChatMessage = {
    role: 'user' | 'model';
    text: string;
};

export interface AIChatConfig {
    /** システムプロンプト（固定文字列） */
    systemPrompt: string;
    /** 初回表示メッセージ */
    welcomeMessage?: string;
    /** API エンドポイント（デフォルト: '/api/chat'） */
    apiUrl?: string;
    /** 動的システムプロンプト（systemPrompt より優先） */
    getSystemPrompt?: () => string;
    /** 実行時コンテキスト（systemPrompt に追加される） */
    buildContext?: () => string;
}

export const useAIChat = (config: AIChatConfig) => {
    const apiUrl = config.apiUrl || '/api/chat';
    const welcomeMsg = config.welcomeMessage || 'こんにちは！何かお手伝いできることはありますか？';

    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<AIChatMessage[]>([
        { role: 'model', text: welcomeMsg }
    ]);

    const getSystemPrompt = useCallback(() => {
        const base = config.getSystemPrompt ? config.getSystemPrompt() : config.systemPrompt;
        const ctx = config.buildContext ? config.buildContext() : '';
        return ctx ? base + '\n\n' + ctx : base;
    }, [config]);

    const sendMessage = useCallback(async (text: string) => {
        const userMsg: AIChatMessage = { role: 'user', text };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    system_prompt: getSystemPrompt(),
                    history: messages.map(m => ({
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: m.text,
                    })),
                }),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const aiText = data.response || data.message || '';

            setMessages(prev => [...prev, { role: 'model', text: aiText }]);
        } catch (error) {
            console.error('[AIChat] Error:', error);
            setMessages(prev => [...prev, {
                role: 'model',
                text: '申し訳ありません。AIサービスに接続できませんでした。しばらくしてからお試しください。',
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, getSystemPrompt, messages]);

    const clearHistory = useCallback(() => {
        setMessages([{ role: 'model', text: welcomeMsg }]);
    }, [welcomeMsg]);

    return { messages, sendMessage, isLoading, isOpen, setIsOpen, clearHistory };
};
