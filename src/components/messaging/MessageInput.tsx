import { useRef, useState, useCallback } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';

export interface MessageInputProps {
  onSend: (content: string, file?: File) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed && !attachedFile) return;
    if (disabled) return;

    onSend(trimmed, attachedFile ?? undefined);
    setContent('');
    setAttachedFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, attachedFile, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = '';
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const canSend = (content.trim().length > 0 || attachedFile) && !disabled;

  return (
    <div className="border-t border-surface-200 bg-white p-4">
      {attachedFile && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-surface-50 border border-surface-200">
          <span className="text-sm text-surface-700 truncate flex-1">{attachedFile.name}</span>
          <button
            type="button"
            onClick={() => setAttachedFile(null)}
            className="p-1 rounded text-surface-500 hover:text-accent-500 hover:bg-accent-50 transition-colors"
            aria-label="Remove attachment"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept="image/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className={cn(
            'p-2.5 rounded-lg shrink-0 transition-colors',
            'text-surface-500 hover:text-brand-600 hover:bg-brand-50',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Attach file"
        >
          <Paperclip size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className={cn(
              'w-full rounded-xl border border-surface-300 px-4 py-2.5 text-sm resize-none',
              'focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[44px] max-h-[120px]'
            )}
          />
        </div>
        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          icon={Send}
          size="md"
          className="shrink-0"
          aria-label="Send message"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
