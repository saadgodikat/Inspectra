import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, ExternalLink, Send, Sparkles, User } from 'lucide-react';
import { chatbotApi } from '../api/client';
import type { ChatbotCitation, ChatbotMessage } from '../api/client';

interface DisplayMessage extends ChatbotMessage {
  citations?: ChatbotCitation[];
}

const suggestedQuestions = [
  'Summarize our current quality status.',
  'Which batches are on hold, and why?',
  'What are the most common defects?',
];

interface Props {
  fullPage?: boolean;
}

export const ChatbotExperience: React.FC<Props> = ({ fullPage = false }) => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (content: string) => {
    const text = content.trim();
    if (!text || sending) return;

    const nextMessages: DisplayMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setDraft('');
    setError(null);
    setSending(true);
    try {
      const history = nextMessages.slice(-11).map(({ role, content: message }) => ({
        role,
        content: message,
      }));
      const result = await chatbotApi.ask(history);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: result.answer, citations: result.citations },
      ]);
    } catch (requestError: unknown) {
      const responseMessage = (requestError as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(responseMessage || 'Could not get an answer. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  return (
    <section className={`flex flex-col bg-surface-container-lowest border border-surface-container-high rounded-xl overflow-hidden ${fullPage ? 'min-h-[min(76vh,850px)]' : 'h-[min(76vh,680px)]'}`}>
      <header className="flex items-center justify-between gap-3 px-space-md py-space-sm border-b border-surface-container-high bg-surface-container-low">
        <div className="flex items-center gap-space-sm min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary-container/20 text-primary flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-body-md font-semibold text-on-surface">Inspectra Assistant</h2>
            <p className="text-label-sm text-outline">Project data only · Local Ollama model</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-label-sm text-tertiary font-mono shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
          LOCAL MODEL
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-md">
        {messages.length === 0 ? (
          <div className="m-auto max-w-lg w-full flex flex-col items-center text-center gap-space-md py-8">
            <div className="w-14 h-14 rounded-2xl bg-primary-container/20 text-primary flex items-center justify-center">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-headline text-headline-md font-bold text-on-surface">Ask about Inspectra</h3>
              <p className="text-body-sm text-on-surface-variant mt-1">
                I can summarize the quality data your account is allowed to see. Answers cite source records when available.
              </p>
            </div>
            <div className="grid gap-2 w-full text-left">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void sendMessage(question)}
                  disabled={sending}
                  className="text-body-sm text-on-surface-variant bg-surface-container-low hover:bg-surface-container-high border border-surface-container-high rounded-lg px-space-md py-space-sm text-left transition-colors disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={`flex gap-space-sm max-w-[95%] ${message.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
            >
              <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${message.role === 'user' ? 'bg-tertiary-container/20 text-tertiary' : 'bg-primary-container/20 text-primary'}`}>
                {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`min-w-0 rounded-xl px-space-md py-space-sm ${message.role === 'user' ? 'bg-primary-container/20 text-on-surface' : 'bg-surface-container text-on-surface'}`}>
                <p className="text-body-sm whitespace-pre-wrap break-words">{message.content}</p>
                {!!message.citations?.length && (
                  <div className="flex flex-wrap gap-1.5 mt-space-sm pt-space-sm border-t border-outline-variant/30">
                    {message.citations.map((citation) => (
                      <Link
                        key={`${citation.type}-${citation.id}`}
                        to={citation.href}
                        className="inline-flex items-center gap-1 text-label-sm text-tertiary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {citation.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))
        )}
        {sending && (
          <div className="self-start flex items-center gap-2 text-label-md text-outline" role="status">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            Assistant is checking project data…
          </div>
        )}
        {error && <p role="alert" className="text-body-sm text-error bg-error-container/20 rounded-lg p-space-sm">{error}</p>}
      </div>

      <form onSubmit={onSubmit} className="p-space-sm border-t border-surface-container-high bg-surface-container-low">
        <div className="flex items-end gap-space-sm">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage(draft);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask a question about project data…"
            aria-label="Ask a question about Inspectra"
            className="min-h-11 max-h-28 flex-1 resize-y rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-space-sm py-2 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="h-11 w-11 shrink-0 flex items-center justify-center rounded-lg bg-primary text-on-primary hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-outline mt-1.5 px-1">
          Local AI can make mistakes. Verify important details in the cited records.
        </p>
      </form>
    </section>
  );
};
