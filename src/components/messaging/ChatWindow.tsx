import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Loader2 } from 'lucide-react';
import { Avatar, EmptyState } from '@/components/ui';
import { STORAGE_BUCKETS, getSignedUrl } from '@/lib/supabase';
import type { Message } from '@/types';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

/**
 * Chat attachments live in a private bucket keyed by conversation, so they need a
 * short-lived signed URL rather than a public one. They are fetched on demand
 * rather than eagerly, so opening a long thread does not sign every file in it.
 */
function useAttachment() {
  const [pending, setPending] = useState<string | null>(null);

  const open = useCallback(async (message: Message) => {
    if (!message.file_url) return;
    setPending(message.id);

    const { url, error } = await getSignedUrl(STORAGE_BUCKETS.CHAT_FILES, message.file_url, 600);
    setPending(null);

    if (!url) {
      toast.error(error ?? 'That attachment is no longer available to you.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  return { pending, open };
}

export interface ChatWindowProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
  isTyping?: boolean;
}

function formatMessageDate(date: string): string {
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

export function ChatWindow({
  messages,
  currentUserId,
  isLoading,
  isTyping,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { pending: pendingAttachment, open: openAttachment } = useAttachment();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin h-10 w-10 rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (messages.length === 0 && !isTyping) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <EmptyState
          icon={FileText}
          title="No messages yet"
          description="Send a message to start the conversation"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <AnimatePresence initial={false}>
        {messages.map((msg, index) => {
          const isSelf = msg.sender_id === currentUserId;
          const msgDate = formatMessageDate(msg.created_at);
          // Derived from the previous message rather than a mutable outer
          // variable: reassigning during render is not safe under the React
          // Compiler, and a re-render could double-insert separators.
          const previousDate =
            index > 0 ? formatMessageDate(messages[index - 1].created_at) : null;
          const showDateSeparator = msgDate !== previousDate;

          const senderName = (msg.sender as { full_name?: string })?.full_name ?? 'Unknown';
          const senderAvatar = (msg.sender as { avatar_url?: string })?.avatar_url;
          const isImage = msg.file_url && /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.file_name ?? '');

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <span className="px-3 py-1 text-xs font-medium text-surface-500 bg-surface-100 rounded-full">
                    {msgDate}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  'flex gap-3',
                  isSelf ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {!isSelf && (
                  <Avatar
                    src={senderAvatar}
                    name={senderName}
                    size="sm"
                    className="shrink-0 mt-1"
                  />
                )}
                <div
                  className={cn(
                    'max-w-[75%] flex flex-col',
                    isSelf ? 'items-end' : 'items-start'
                  )}
                >
                  {!isSelf && (
                    <span className="text-xs font-medium text-surface-600 mb-1">{senderName}</span>
                  )}
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5',
                      isSelf
                        ? 'bg-brand-500 text-white rounded-br-md'
                        : 'bg-surface-100 text-surface-900 rounded-bl-md'
                    )}
                  >
                    {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
                    {msg.file_url && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => void openAttachment(msg)}
                          disabled={pendingAttachment === msg.id}
                          className={cn(
                            'inline-flex items-center gap-2 text-sm rounded',
                            'hover:underline disabled:opacity-70',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                            isSelf ? 'focus-visible:ring-white' : 'focus-visible:ring-brand-500'
                          )}
                        >
                          {pendingAttachment === msg.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <FileText size={16} />
                          )}
                          {msg.file_name ?? 'Open attachment'}
                          {isImage ? ' (image)' : ''}
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-surface-500 mt-1">
                    {format(new Date(msg.created_at), 'h:mm a')}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {isTyping && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-2 items-center text-surface-500 text-sm"
        >
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>Typing...</span>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
