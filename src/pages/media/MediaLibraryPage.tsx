/**
 * Media library.
 *
 * Everything the signed-in user has captured in the field or imported from
 * another device, in one place, with the two things they actually want to do
 * with it: put it on a case, or send it to an administrator.
 *
 * Before this existed, a capture went straight into a `media_reports` row and
 * the file itself was never tracked. You had to know which institution a
 * recording concerned before you were allowed to keep it, the same clip could
 * not be used on two cases without uploading it twice, and footage from a body
 * camera or a wearable had nowhere to go at all.
 */
import { useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, Film, Mic, Image as ImageIcon, FileText, Trash2,
  Paperclip, Send, MapPin, ShieldCheck, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  Button, Card, CardContent, Input, TextArea, Select, Modal, Spinner, Badge,
} from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useCaseStore } from '@/stores/caseStore';
import { useMediaStore } from '@/stores/mediaStore';
import { STORAGE_BUCKETS, resolveStorageUrl } from '@/lib/supabase';
import {
  addToLibrary, listLibrary, deleteLibraryItem, attachToCase, submitToAdmin,
} from '@/services/mediaLibraryService';
import { MEDIA_KIND_LABELS, type MediaLibraryItem } from '@/types';

type KindFilter = 'all' | MediaLibraryItem['media_kind'];

const KIND_ICON = {
  video: Film,
  audio: Mic,
  photo: ImageIcon,
  document: FileText,
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const user = useAuthStore((s) => s.user);
  const { cases, fetchCases } = useCaseStore();
  const { institutions, fetchInstitutions } = useMediaStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<MediaLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [preview, setPreview] = useState<{ item: MediaLibraryItem; url: string } | null>(null);
  const [attachTarget, setAttachTarget] = useState<MediaLibraryItem | null>(null);
  const [submitTarget, setSubmitTarget] = useState<MediaLibraryItem | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { items: rows, error } = await listLibrary(user.user_id);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    setItems(rows);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  /*
   * `?attach=<id>` opens the attach dialog for one item.
   *
   * The field recording screen hands off here after saving a capture: an item
   * has to exist before it can be attached, so "use in a case" saves first and
   * then sends the agent straight to the case picker rather than leaving them
   * to find the recording in a grid.
   *
   * The parameter is cleared once consumed, so a refresh or a back-navigation
   * does not reopen a dialog the agent has already dealt with.
   */
  useEffect(() => {
    const id = searchParams.get('attach');
    if (!id || items.length === 0) return;

    const item = items.find((i) => i.id === id);
    if (item) setAttachTarget(item);
    else toast.error('That recording is no longer in your library.');

    setSearchParams((params) => {
      params.delete('attach');
      return params;
    }, { replace: true });
  }, [items, searchParams, setSearchParams]);
  useEffect(() => { void fetchCases(); void fetchInstitutions(); }, [fetchCases, fetchInstitutions]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((i) => {
      if (kind !== 'all' && i.media_kind !== kind) return false;
      if (!term) return true;
      return (
        i.file_name.toLowerCase().includes(term) ||
        (i.note ?? '').toLowerCase().includes(term)
      );
    });
  }, [items, kind, search]);

  /**
   * Import from the device.
   *
   * This is the path for anything not recorded in the app — a wearable, a body
   * camera, a dashcam, a scanned document. Such files are marked `import`
   * rather than `capture`, because their timestamp and any coordinates came
   * from the file rather than from this app observing them, and presenting
   * those as witnessed would overstate what we know.
   */
  const onFilesPicked = async (fileList: FileList | null) => {
    if (!fileList?.length || !user) return;

    setUploading(true);
    let added = 0;

    for (const file of Array.from(fileList)) {
      const { error } = await addToLibrary({
        ownerId: user.user_id,
        file,
        fileName: file.name,
        source: 'import',
        // `lastModified` is the device's claim about the file, not ours.
        capturedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      });

      if (error) toast.error(`${file.name}: ${error}`);
      else added += 1;
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (added) {
      toast.success(added === 1 ? 'Added to your library.' : `${added} files added.`);
      void load();
    }
  };

  const openPreview = async (item: MediaLibraryItem) => {
    const url = await resolveStorageUrl(STORAGE_BUCKETS.MEDIA_REPORTS, item.file_path);
    if (!url) {
      toast.error('That file could not be loaded from storage.');
      return;
    }
    setPreview({ item, url });
  };

  const remove = async (item: MediaLibraryItem) => {
    if (!window.confirm(`Delete ${item.file_name}? This cannot be undone.`)) return;
    const { error } = await deleteLibraryItem(item);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Deleted.');
    void load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Media library</h1>
          <p className="text-surface-500 text-sm">
            Everything you have recorded or imported. Attach to a case, or send to an
            administrator.
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            // Deliberately broad: body cameras and wearables produce containers
            // browsers do not always name correctly, and documents are a
            // first-class kind here rather than an afterthought.
            accept="video/*,audio/*,image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
            onChange={(e) => void onFilesPicked(e.target.files)}
          />
          <Button
            icon={Upload}
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Import from device
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file name or note"
            className="w-full rounded-lg border border-surface-300 py-2.5 pl-10 pr-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          {(['all', 'video', 'audio', 'photo', 'document'] as KindFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                kind === k
                  ? 'whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white'
                  : 'whitespace-nowrap rounded-lg border border-surface-300 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50'
              }
            >
              {k === 'all' ? 'All' : MEDIA_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-surface-600 font-medium">Nothing here yet</p>
            <p className="mt-1 text-sm text-surface-500">
              Record in the field, or import footage from a body camera or wearable.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => {
            const Icon = KIND_ICON[item.media_kind];
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => void openPreview(item)}
                      className="flex aspect-video items-center justify-center rounded-lg bg-surface-100 transition-colors hover:bg-surface-200"
                    >
                      <Icon className="h-8 w-8 text-surface-400" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900" title={item.file_name}>
                        {item.file_name}
                      </p>
                      <p className="mt-0.5 text-xs text-surface-500">
                        {MEDIA_KIND_LABELS[item.media_kind]} · {formatBytes(item.file_size)}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {/* Says where the metadata came from. An imported file's
                            timestamp is the device's claim, not our observation. */}
                        <Badge variant={item.source === 'capture' ? 'success' : 'default'}>
                          {item.source === 'capture' ? 'Recorded in app' : 'Imported'}
                        </Badge>
                        {item.gps_latitude != null && (
                          <span className="inline-flex items-center gap-1 text-xs text-surface-500">
                            <MapPin className="h-3 w-3" /> GPS
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 border-t border-surface-100 pt-3">
                      <Button size="sm" variant="secondary" icon={Paperclip}
                        onClick={() => setAttachTarget(item)}>
                        Case
                      </Button>
                      <Button size="sm" variant="secondary" icon={Send}
                        onClick={() => setSubmitTarget(item)}>
                        Admin
                      </Button>
                      <button
                        type="button"
                        onClick={() => void remove(item)}
                        className="ml-auto rounded-lg p-2 text-surface-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete ${item.file_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <PreviewModal preview={preview} onClose={() => setPreview(null)} />

      <AttachModal
        item={attachTarget}
        cases={cases}
        onClose={() => setAttachTarget(null)}
        onDone={() => { setAttachTarget(null); }}
      />

      <SubmitModal
        item={submitTarget}
        institutions={institutions}
        onClose={() => setSubmitTarget(null)}
        onDone={() => { setSubmitTarget(null); }}
      />
    </div>
  );
}

function PreviewModal({
  preview, onClose,
}: {
  preview: { item: MediaLibraryItem; url: string } | null;
  onClose: () => void;
}) {
  if (!preview) return null;
  const { item, url } = preview;

  return (
    <Modal isOpen onClose={onClose} title={item.file_name} size="xl">
      <div className="space-y-4">
        {item.media_kind === 'video' ? (
          <video src={url} controls playsInline className="max-h-[60vh] w-full rounded-lg bg-black" />
        ) : item.media_kind === 'audio' ? (
          <audio src={url} controls className="w-full" />
        ) : item.media_kind === 'photo' ? (
          <img src={url} alt={item.file_name} className="max-h-[60vh] w-full rounded-lg object-contain" />
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-2 text-brand-600 hover:underline">
            <FileText className="h-4 w-4" /> Open document
          </a>
        )}

        {/* The digest is what makes this material defensible later. Showing it
            here means the person who filed it can verify the file they are
            looking at is the file they recorded. */}
        <div className="rounded-lg bg-surface-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-surface-700">
            <ShieldCheck className="h-3.5 w-3.5" /> SHA-256
          </p>
          <p className="mt-1 break-all font-mono text-xs text-surface-500">{item.file_hash}</p>
        </div>
      </div>
    </Modal>
  );
}

function AttachModal({
  item, cases, onClose, onDone,
}: {
  item: MediaLibraryItem | null;
  cases: { id: string; title: string; category: string; status: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [caseId, setCaseId] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  if (!item) return null;

  const go = async () => {
    if (!caseId) {
      toast.error('Choose a case.');
      return;
    }
    setBusy(true);
    const { error } = await attachToCase(item.id, caseId, description.trim() || undefined);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Attached to the case as evidence.');
    setCaseId('');
    setDescription('');
    onDone();
  };

  return (
    <Modal isOpen onClose={onClose} title="Attach to a case" size="md">
      <div className="space-y-4">
        <p className="text-sm text-surface-600">
          A copy of <span className="font-medium">{item.file_name}</span> is added to the
          case as evidence, with its hash and capture details. It stays in your library.
        </p>

        <Select
          label="Case"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          options={[
            { value: '', label: 'Select a case…' },
            // There is no case_number column. Category and status are what
            // actually tell two similarly titled cases apart.
            ...cases.map((c) => ({
              value: c.id,
              label: `${c.title} — ${c.category}, ${c.status.replace(/_/g, ' ')}`,
            })),
          ]}
        />

        <TextArea
          label="What does this show? (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void go()} loading={busy} icon={Paperclip}>Attach</Button>
        </div>
      </div>
    </Modal>
  );
}

function SubmitModal({
  item, institutions, onClose, onDone,
}: {
  item: MediaLibraryItem | null;
  institutions: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [institutionId, setInstitutionId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);

  if (!item) return null;

  const go = async () => {
    setBusy(true);
    const { error } = await submitToAdmin(
      item.id,
      institutionId,
      title.trim(),
      description.trim(),
      tags.split(',').map((t) => t.trim()).filter(Boolean)
    );
    setBusy(false);
    if (error) {
      // The RPC's messages are written to be shown to people.
      toast.error(error);
      return;
    }
    toast.success('Sent for review. An administrator decides whether it is published.');
    setTitle(''); setDescription(''); setTags(''); setInstitutionId('');
    onDone();
  };

  return (
    <Modal isOpen onClose={onClose} title="Send to an administrator" size="md">
      <div className="space-y-4">
        <Select
          label="Institution"
          value={institutionId}
          onChange={(e) => setInstitutionId(e.target.value)}
          options={[
            { value: '', label: 'Select an institution…' },
            ...institutions.map((i) => ({ value: i.id, label: i.name })),
          ]}
        />

        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

        <TextArea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe what the recording shows — at least 20 characters."
        />

        <Input
          label="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        <p className="rounded-lg bg-surface-50 p-3 text-xs text-surface-500">
          Field reports always enter review before publication. That is what keeps
          unverified allegations about named institutions off the public archive.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void go()} loading={busy} icon={Send}>Send for review</Button>
        </div>
      </div>
    </Modal>
  );
}
