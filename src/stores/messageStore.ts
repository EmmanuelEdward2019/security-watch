import { create } from 'zustand';
import type { Conversation, Message } from '@/types';
import { supabase } from '@/lib/supabase';

interface MessageState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  realtimeChannel: ReturnType<typeof supabase.channel> | null;

  fetchConversations: (userId: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, senderId: string, content: string, fileUrl?: string, fileName?: string) => Promise<{ error: string | null }>;
  createConversation: (type: 'direct' | 'group', participantIds: string[], caseId?: string, title?: string) => Promise<{ id: string | null; error: string | null }>;
  addParticipant: (conversationId: string, userId: string) => Promise<{ error: string | null }>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  subscribeToMessages: (conversationId: string) => void;
  unsubscribeFromMessages: () => void;
  markAsRead: (conversationId: string, userId: string) => Promise<void>;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  realtimeChannel: null,

  fetchConversations: async (userId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        conversations(
          *,
          conversation_participants(*, profile:profiles(*))
        )
      `)
      .eq('user_id', userId);

    if (!error && data) {
      const convs = data
        .map((d: Record<string, unknown>) => d.conversations as Conversation)
        .filter(Boolean);
      set({ conversations: convs });
    }
    set({ isLoading: false });
  },

  fetchMessages: async (conversationId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error && data) set({ messages: data as Message[] });
  },

  sendMessage: async (conversationId, senderId, content, fileUrl, fileName) => {
    // sender_id is overwritten with the authenticated identity by a trigger, so
    // it cannot be spoofed regardless of what is passed here.
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      file_url: fileUrl,
      file_name: fileName,
      is_encrypted: false,
    });

    if (error) return { error: error.message };
    return { error: null };
  },

  /**
   * Starts a conversation.
   *
   * This used to insert the conversation and then batch-insert a participant row
   * per member — which RLS rejected for every member except the caller, so
   * starting a chat with anyone else silently failed and left an orphaned
   * conversation with no participants.
   *
   * The self-insert policy that caused it was also the hole that let any
   * authenticated user add themselves to *any* conversation and read its
   * messages. Both are fixed by the same change: membership is now only granted
   * by an RPC that verifies the caller belongs there, and enrols everyone
   * atomically. It also reuses an existing direct thread instead of duplicating.
   */
  createConversation: async (type, participantIds, caseId, title) => {
    const { data, error } = await supabase.rpc('create_conversation', {
      p_type: type,
      p_participant_ids: participantIds,
      p_case_id: caseId ?? null,
      p_title: title ?? null,
    });

    if (error) return { id: null, error: error.message };
    return { id: data as string, error: null };
  },

  addParticipant: async (conversationId, userId) => {
    const { error } = await supabase.rpc('add_conversation_participant', {
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
    return { error: error?.message ?? null };
  },

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  subscribeToMessages: (conversationId) => {
    const existing = get().realtimeChannel;
    if (existing) existing.unsubscribe();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', payload.new.sender_id)
            .single();

          const newMessage = { ...payload.new, sender: data } as Message;
          set((state) => ({ messages: [...state.messages, newMessage] }));
        }
      )
      .subscribe();

    set({ realtimeChannel: channel });
  },

  unsubscribeFromMessages: () => {
    const channel = get().realtimeChannel;
    if (channel) {
      channel.unsubscribe();
      set({ realtimeChannel: null });
    }
  },

  markAsRead: async (conversationId, userId) => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .is('read_at', null);
  },
}));
