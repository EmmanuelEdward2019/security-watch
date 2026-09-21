import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCirclePlus, ArrowLeft, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import { Button, Modal, Avatar } from '@/components/ui';
import { ConversationList, ChatWindow, MessageInput } from '@/components/messaging';
import { uploadFile, buildObjectPath, STORAGE_BUCKETS } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Conversation, UserRole } from '@/types';
import { USER_ROLE_LABELS } from '@/types';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

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

export function MessagingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const {
    conversations,
    currentConversation,
    messages,
    isLoading,
    fetchConversations,
    fetchMessages,
    sendMessage,
    createConversation,
    setCurrentConversation,
    subscribeToMessages,
    unsubscribeFromMessages,
    markAsRead,
  } = useMessageStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [sending, setSending] = useState(false);

  // Fetch users for new conversation
  const [allUsers, setAllUsers] = useState<
    { id: string; full_name: string; avatar_url?: string; role: string; is_team: boolean }[]
  >([]);
  const [contactSearch, setContactSearch] = useState('');
  const [myCases, setMyCases] = useState<{ id: string; title: string }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [newConvCaseId, setNewConvCaseId] = useState('');
  const [newConvTitle, setNewConvTitle] = useState('');
  const [creatingConv, setCreatingConv] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }
    fetchConversations(user.user_id);
  }, [isAuthenticated, user, navigate, fetchConversations]);

  /*
   * Who can be messaged comes from `messaging_contacts()` (035), not a raw
   * select on `profiles`. That select was capped at 50 with no search — so an
   * administrator could not reach the 51st user — and, through RLS, never
   * included the team for anyone else, so a user had no one to ask for help.
   * The function applies the same `can_message` rule `create_conversation`
   * enforces, and returns name, avatar and role only.
   */
  useEffect(() => {
    if (!showNewConversation) return;
    const handle = setTimeout(() => {
      void supabase
        .rpc('messaging_contacts', {
          p_search: contactSearch.trim() || undefined,
          p_limit: 100,
        })
        .then(({ data, error }) => {
          if (error) {
            toast.error(error.message);
            return;
          }
          const rows = (data ?? []) as Array<{
            user_id: string;
            full_name: string | null;
            avatar_url: string | null;
            role: string;
            is_team: boolean;
          }>;
          setAllUsers(
            rows.map((p) => ({
              id: p.user_id,
              full_name: p.full_name ?? 'Unknown',
              avatar_url: p.avatar_url ?? undefined,
              role: p.role,
              is_team: p.is_team,
            }))
          );
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [showNewConversation, contactSearch]);

  // The case link was a free-text "Case ID" box. Nobody knows their case's
  // UUID, so it was never filled in. Offer the cases this person can see.
  useEffect(() => {
    if (!showNewConversation) return;
    void supabase
      .from('cases')
      .select('id, title')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setMyCases((data ?? []) as { id: string; title: string }[]));
  }, [showNewConversation]);

  useEffect(() => {
    if (currentConversation) {
      fetchMessages(currentConversation.id);
      subscribeToMessages(currentConversation.id);
      if (user) markAsRead(currentConversation.id, user.user_id);
      setMobileView('chat');
    }
    return () => unsubscribeFromMessages();
  }, [currentConversation?.id, user, fetchMessages, subscribeToMessages, unsubscribeFromMessages, markAsRead]);

  const handleSendMessage = useCallback(
    async (content: string, file?: File) => {
      if (!currentConversation || !user) return;
      setSending(true);
      let fileUrl: string | undefined;
      let fileName: string | undefined;
      if (file) {
        // Keyed by conversation: the chat-files policy grants only that
        // conversation's participants. Previously any logged-in account could
        // read every chat attachment in the platform.
        const path = buildObjectPath(currentConversation.id, file.name);
        const { path: storedPath, error } = await uploadFile(
          STORAGE_BUCKETS.CHAT_FILES,
          path,
          file
        );
        if (error) {
          toast.error(`Could not upload that file: ${error}`);
          setSending(false);
          return;
        }
        // The object path is stored, not a URL — the bucket is private and reads
        // go through a short-lived signed URL.
        fileUrl = storedPath;
        fileName = file.name;
      }
      const { error } = await sendMessage(
        currentConversation.id,
        user.user_id,
        content || ' ',
        fileUrl,
        fileName
      );
      setSending(false);
      if (error) toast.error(error);
    },
    [currentConversation, user, sendMessage]
  );

  const handleCreateConversation = async () => {
    if (selectedUserIds.length === 0) {
      toast.error('Select at least one person');
      return;
    }
    setCreatingConv(true);
    const participantIds = [user!.user_id, ...selectedUserIds];
    const { id, error } = await createConversation(
      selectedUserIds.length > 1 ? 'group' : 'direct',
      participantIds,
      newConvCaseId || undefined,
      newConvTitle || undefined
    );
    setCreatingConv(false);
    if (error) {
      toast.error(error);
      return;
    }
    setShowNewConversation(false);
    setSelectedUserIds([]);
    setNewConvCaseId('');
    setNewConvTitle('');
    if (id) {
      await fetchConversations(user!.user_id);
      const convs = useMessageStore.getState().conversations;
      const newConv = convs.find((c) => c.id === id);
      if (newConv) setCurrentConversation(newConv);
    }
    toast.success('Conversation created');
  };

  if (!user) return null;

  const { name, avatar } = currentConversation
    ? getConversationDisplay(currentConversation, user.user_id)
    : { name: '', avatar: undefined };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row rounded-xl border border-surface-200 bg-white overflow-hidden shadow-sm">
      {/* Left panel - conversation list */}
      <div
        className={cn(
          'flex flex-col w-full lg:w-80 border-r border-surface-200 shrink-0',
          mobileView === 'chat' && 'hidden lg:flex'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200">
          <h2 className="text-lg font-semibold text-surface-900">Messages</h2>
          <Button
            variant="ghost"
            size="sm"
            icon={MessageCirclePlus}
            onClick={() => setShowNewConversation(true)}
          >
            New
          </Button>
        </div>
        <ConversationList
          conversations={conversations}
          currentConversationId={currentConversation?.id ?? null}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectConversation={(c) => setCurrentConversation(c)}
          isLoading={isLoading}
          currentUserId={user.user_id}
        />
      </div>

      {/* Right panel - active chat */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0',
          !currentConversation && 'hidden lg:flex'
        )}
      >
        {currentConversation ? (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-surface-200 bg-surface-50/50">
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className="lg:hidden p-2 rounded-lg hover:bg-surface-200"
                aria-label="Back to list"
              >
                <ArrowLeft size={20} />
              </button>
              <Avatar src={avatar} name={name} size="md" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-surface-900 truncate">{name}</h3>
                {currentConversation.case_id && (
                  <button
                    type="button"
                    onClick={() => navigate(`/app/cases/${currentConversation.case_id}`)}
                    className="text-sm text-brand-600 hover:underline inline-flex items-center gap-1"
                  >
                    View case <ExternalLink size={14} />
                  </button>
                )}
              </div>
            </div>
            <ChatWindow
              messages={messages}
              currentUserId={user.user_id}
              isLoading={false}
            />
            <MessageInput
              onSend={handleSendMessage}
              disabled={sending}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-surface-500">
            <div className="text-center">
              <MessageCirclePlus size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* New conversation modal */}
      <Modal
        isOpen={showNewConversation}
        onClose={() => {
          setShowNewConversation(false);
          setSelectedUserIds([]);
          setContactSearch('');
        }}
        title="New Conversation"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Select people</label>
            <p className="mb-2 text-xs text-surface-500">
              The Security Watch team, and anyone you share a case or property enquiry with.
            </p>
            <input
              type="search"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search by name"
              className="mb-2 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
            />
            {allUsers.length === 0 && (
              <p className="rounded-lg border border-dashed border-surface-200 p-3 text-sm text-surface-500">
                {contactSearch.trim()
                  ? 'No one matches that name.'
                  : 'No one to message yet. People appear here once you share a case or property enquiry with them.'}
              </p>
            )}
            <div className="max-h-64 overflow-y-auto border border-surface-200 rounded-lg divide-y divide-surface-100">
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    setSelectedUserIds((prev) =>
                      prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                    )
                  }
                  className={cn(
                    'w-full flex items-center gap-3 p-3 text-left hover:bg-surface-50 transition-colors',
                    selectedUserIds.includes(u.id) && 'bg-brand-50'
                  )}
                >
                  <Avatar src={u.avatar_url} name={u.full_name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{u.full_name}</span>
                    <span className="block text-xs text-surface-500">
                      {u.is_team
                        ? 'The Security Watch team'
                        : USER_ROLE_LABELS[u.role as UserRole] ?? u.role}
                    </span>
                  </span>
                  {selectedUserIds.includes(u.id) && (
                    <span className="ml-auto text-brand-600 text-sm">Selected</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Title (optional, for groups)</label>
            <input
              type="text"
              value={newConvTitle}
              onChange={(e) => setNewConvTitle(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">About a case (optional)</label>
            <select
              value={newConvCaseId}
              onChange={(e) => setNewConvCaseId(e.target.value)}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
            >
              <option value="">Not about a particular case</option>
              {myCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowNewConversation(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConversation} loading={creatingConv}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
