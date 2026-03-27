import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageCircle } from 'lucide-react';
import { Avatar, Badge, Input, EmptyState } from '@/components/ui';
import type { Conversation } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/utils/cn';

export interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectConversation: (conversation: Conversation) => void;
  isLoading?: boolean;
  currentUserId: string;
}

function getConversationDisplay(conv: Conversation, currentUserId: string): { name: string; avatar?: string } {
  const participants = conv.participants?.filter((p) => p.user_id !== currentUserId) ?? [];
  if (participants.length === 0) return { name: 'Unknown' };
  if (participants.length === 1) {
    const p = participants[0];
    return {
      name: (p.profile as { full_name?: string })?.full_name ?? 'Unknown',
      avatar: (p.profile as { avatar_url?: string })?.avatar_url,
    };
  }
  return { name: conv.title ?? `${participants.length} participants` };
}

export function ConversationList({
  conversations,
  currentConversationId,
  searchQuery,
  onSearchChange,
  onSelectConversation,
  isLoading,
  currentUserId,
}: ConversationListProps) {
  const filtered = searchQuery.trim()
    ? conversations.filter((c) => {
        const { name } = getConversationDisplay(c, currentUserId);
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : conversations;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-surface-200">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
            size={18}
          />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title={searchQuery ? 'No matches' : 'No conversations'}
            description={
              searchQuery
                ? 'Try a different search term'
                : 'Start a new conversation to get started'
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((conv, index) => {
              const { name, avatar } = getConversationDisplay(conv, currentUserId);
              const isActive = conv.id === currentConversationId;
              const preview = (conv.last_message as { content?: string })?.content ?? '';
              const time = conv.last_message
                ? formatDistanceToNow(new Date((conv.last_message as { created_at?: string }).created_at ?? ''), {
                    addSuffix: true,
                  })
                : '';
              const unread = (conv.unread_count ?? 0) > 0;

              return (
                <motion.button
                  key={conv.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => onSelectConversation(conv)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-surface-100',
                    isActive ? 'bg-brand-50' : 'hover:bg-surface-50'
                  )}
                >
                  <Avatar
                    src={avatar}
                    name={name}
                    size="md"
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'font-medium truncate',
                          unread ? 'text-surface-900' : 'text-surface-700'
                        )}
                      >
                        {name}
                      </span>
                      <span className="text-xs text-surface-500 shrink-0">{time}</span>
                    </div>
                    <p className="text-sm text-surface-500 truncate mt-0.5">{preview || 'No messages yet'}</p>
                  </div>
                  {unread && (
                    <Badge variant="success" size="sm" className="shrink-0">
                      {conv.unread_count}
                    </Badge>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
