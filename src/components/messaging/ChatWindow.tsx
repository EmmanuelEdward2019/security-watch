import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText } from 'lucide-react';
import { Avatar, EmptyState } from '@/components/ui';
import type { Message } from '@/types';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/utils/cn';

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

  let lastDate: string | null = null;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <AnimatePresence initial={false}>
        {messages.map((msg) => {
          const isSelf = msg.sender_id === currentUserId;
          const msgDate = formatMessageDate(msg.created_at);
          const showDateSeparator = msgDate !== lastDate;
          if (showDateSeparator) lastDate = msgDate;

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
                        {isImage ? (
                          <a
                            href={msg.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg overflow-hidden max-w-[200px]"
                          >
                            <img
                              src={msg.file_url}
                              alt={msg.file_name ?? 'Attachment'}
                              className="w-full h-auto object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            href={msg.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm hover:underline"
                          >
                            <FileText size={16} />
                            {msg.file_name ?? 'Download file'}
                          </a>
                        )}
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
