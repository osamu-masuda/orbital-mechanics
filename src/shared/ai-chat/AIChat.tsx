import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAIChat, type AIChatConfig } from './useAIChat';
import './AIChat.css';

interface AIChatProps {
    /** useAIChat に渡す設定 */
    config: AIChatConfig;
    /** ヘッダータイトル */
    title?: string;
    /** ヘッダーサブタイトル */
    subtitle?: string;
    /** ヘッダーアイコン（絵文字） */
    icon?: string;
    /** ヒントチップ（初回表示時に表示） */
    hints?: string[];
    /** 入力プレースホルダー */
    placeholder?: string;
    /** 外部コンポーネントからメッセージを受け付けるカスタムイベント名 */
    externalEventName?: string;
}

export const AIChat = ({
    config,
    title = 'AI アシスタント',
    subtitle,
    icon = '🤖',
    hints = [],
    placeholder = '質問を入力...',
    externalEventName,
}: AIChatProps) => {
    const { messages, sendMessage, isLoading, isOpen, setIsOpen } = useAIChat(config);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    // 外部イベントリスナー（music の ai-request 等）
    useEffect(() => {
        if (!externalEventName) return;
        const handler = (e: Event) => {
            const { prompt } = (e as CustomEvent).detail || {};
            if (prompt) {
                setIsOpen(true);
                sendMessage(prompt);
            }
        };
        window.addEventListener(externalEventName, handler);
        return () => window.removeEventListener(externalEventName, handler);
    }, [externalEventName, sendMessage, setIsOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        const text = input;
        setInput('');
        await sendMessage(text);
    };

    const handleHintClick = (hint: string) => {
        const text = hint.replace(/^[^\s]+\s/, '');
        sendMessage(text);
    };

    const formatText = (text: string) => {
        return text.split('**').map((part, i) =>
            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
        );
    };

    return (
        <>
            {/* FAB */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className={`ai-fab ${isOpen ? 'open' : ''}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="AI Assistant"
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="ai-chat-window"
                    >
                        {/* Header */}
                        <div className="ai-chat-header">
                            <div className="ai-chat-header-left">
                                <div className="ai-chat-header-icon">{icon}</div>
                                <div>
                                    <div className="ai-chat-title">{title}</div>
                                    {subtitle && <div className="ai-chat-subtitle">{subtitle}</div>}
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="ai-chat-messages">
                            {messages.length <= 1 && !isLoading && hints.length > 0 && (
                                <div className="ai-welcome">
                                    <div className="ai-welcome-hints">
                                        {hints.map((hint, i) => (
                                            <button
                                                key={i}
                                                className="ai-hint-chip"
                                                onClick={() => handleHintClick(hint)}
                                            >
                                                {hint}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`ai-message-row ${msg.role === 'user' ? 'user' : 'model'}`}
                                >
                                    <div className={`ai-message ${msg.role === 'user' ? 'user' : 'model'}`}>
                                        {formatText(msg.text)}
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="ai-message-row model">
                                    <div className="ai-typing">
                                        <Loader className="ai-typing-spinner" size={14} />
                                        <span className="ai-typing-text">考え中...</span>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form className="ai-chat-input-area" onSubmit={handleSubmit}>
                            <div className="ai-input-wrapper">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    placeholder={placeholder}
                                    className="ai-chat-input"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    className="ai-send-btn"
                                    disabled={!input.trim() || isLoading}
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
