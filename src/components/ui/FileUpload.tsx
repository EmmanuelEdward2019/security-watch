import { useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileText, Image } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  size: number;
}

export interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  value?: UploadedFile[];
  onChange?: (files: UploadedFile[]) => void;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  return FileText;
}

export function FileUpload({
  accept = 'image/*,.pdf,.doc,.docx',
  multiple = true,
  maxSize = 10 * 1024 * 1024,
  value = [],
  onChange,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const files = value;

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles: UploadedFile[] = [];
      const errors: string[] = [];

      for (const file of fileArray) {
        if (file.size > maxSize) {
          errors.push(`${file.name} exceeds ${formatFileSize(maxSize)} limit`);
          continue;
        }
        const preview =
          file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
        validFiles.push({
          id: `${file.name}-${file.size}-${Date.now()}`,
          file,
          preview,
          size: file.size,
        });
      }

      if (errors.length) setError(errors[0]);
      else setError(null);

      const updated = multiple ? [...files, ...validFiles] : validFiles;
      onChange?.(updated);
    },
    [files, maxSize, multiple, onChange]
  );

  const removeFile = useCallback(
    (id: string) => {
      const file = files.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      onChange?.(files.filter((f) => f.id !== id));
    },
    [files, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className={cn('space-y-3', className)}>
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors',
          isDragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-surface-300 hover:border-brand-400 hover:bg-surface-50',
          error && 'border-accent-300 bg-accent-50/50'
        )}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            const { files: f } = e.target;
            if (f) addFiles(f);
            e.target.value = '';
          }}
        />
        <motion.div
          animate={{ y: isDragging ? -2 : 0 }}
          className="text-surface-500 mb-2"
        >
          <Upload size={40} strokeWidth={1.5} />
        </motion.div>
        <p className="text-sm font-medium text-surface-700">
          {isDragging ? 'Drop files here' : 'Drag and drop or click to upload'}
        </p>
        <p className="text-xs text-surface-500 mt-1">
          {accept} (max {formatFileSize(maxSize)})
        </p>
        {error && (
          <p className="text-sm text-accent-500 mt-2" role="alert">
            {error}
          </p>
        )}
      </motion.div>

      <AnimatePresence mode="popLayout">
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid gap-2"
          >
            {files.map((f) => {
              const Icon = getFileIcon(f.file.type);
              return (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 rounded-lg border border-surface-200 bg-white p-3"
                >
                  {f.preview ? (
                    <img
                      src={f.preview}
                      alt=""
                      className="h-12 w-12 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-surface-100 flex items-center justify-center shrink-0">
                      <Icon size={24} className="text-surface-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-surface-900 truncate">
                      {f.file.name}
                    </p>
                    <p className="text-xs text-surface-500">
                      {formatFileSize(f.size)}
                    </p>
                  </div>
                  <motion.button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(f.id);
                    }}
                    className="p-2 rounded-lg text-surface-500 hover:text-accent-500 hover:bg-accent-50 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    aria-label={`Remove ${f.file.name}`}
                  >
                    <X size={18} />
                  </motion.button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
