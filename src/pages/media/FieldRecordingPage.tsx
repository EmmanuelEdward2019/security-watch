import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Video,
  Mic,
  Square,
  MapPin,
  Building2,
  Upload,
  Camera,
  AlertTriangle,
  RotateCcw,
  Crosshair,
} from 'lucide-react';
import {
  Button,
  Input,
  TextArea,
  Select,
  Card,
  CardHeader,
  CardContent,
  Spinner,
  Badge,
} from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useMediaStore } from '@/stores/mediaStore';
import {
  STORAGE_BUCKETS,
  buildObjectPath,
  uploadFile,
  generateFileHash,
} from '@/lib/supabase';
import toast from 'react-hot-toast';

type CaptureMode = 'video' | 'audio' | 'photo';

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Field capture for media agents.
 *
 * This page previously had no capture code at all — no getUserMedia, no
 * MediaRecorder, no geolocation — despite the platform advertising "GPS and
 * timestamp auto-attachment". It now records from the device camera and
 * microphone, stamps the coordinates and capture time onto the report, and
 * uploads straight to the private media bucket.
 *
 * Everything filed here enters as `pending_review`: publication is an admin
 * decision, which is what keeps unverified allegations about named institutions
 * off the public archive.
 */
export default function FieldRecordingPage() {
  const user = useAuthStore((s) => s.user);
  const { institutions, fetchInstitutions, createMediaReport } = useMediaStore();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [mode, setMode] = useState<CaptureMode>('video');
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [captured, setCaptured] = useState<{ blob: Blob; url: string; name: string; type: string } | null>(null);

  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);

  const [institutionId, setInstitutionId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchInstitutions();
  }, [fetchInstitutions]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Release the camera and any preview URL when the page unmounts — a hot
  // camera light left on after navigation is alarming for a field user.
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [stopStream]);

  useEffect(() => {
    return () => {
      if (captured?.url) URL.revokeObjectURL(captured.url);
    };
  }, [captured?.url]);

  const requestDevices = async (nextMode: CaptureMode) => {
    stopStream();
    setPermissionState('requesting');

    try {
      const constraints: MediaStreamConstraints =
        nextMode === 'audio'
          ? { audio: true }
          : {
              audio: nextMode === 'video',
              video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (nextMode !== 'audio' && videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {
          /* autoplay policies — the user can press play */
        });
      }

      setPermissionState('granted');
    } catch (err) {
      setPermissionState('denied');
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError') {
        toast.error('Camera and microphone access was blocked. Enable it in your browser settings to record.');
      } else if (name === 'NotFoundError') {
        toast.error('No camera or microphone was found on this device.');
      } else {
        toast.error('Could not open the camera. Close other apps using it and try again.');
      }
    }
  };

  const captureLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error('This device does not report location.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocating(false);
        toast.success('Location captured.');
      },
      (error) => {
        setLocating(false);
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? 'Location access was denied. A report without coordinates is still accepted, but GPS makes it far more useful.'
            : 'Could not get a location fix. Try again outdoors.'
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  };

  const pickMimeType = (forMode: CaptureMode): string => {
    const candidates =
      forMode === 'audio'
        ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) {
      toast.error('Start the camera first.');
      return;
    }

    chunksRef.current = [];
    const mimeType = pickMimeType(mode);

    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || (mode === 'audio' ? 'audio/webm' : 'video/webm');
        const blob = new Blob(chunksRef.current, { type });
        const extension = type.includes('mp4') ? 'mp4' : 'webm';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');

        setCaptured({
          blob,
          url: URL.createObjectURL(blob),
          name: `field-${mode}-${stamp}.${extension}`,
          type,
        });
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      setCapturedAt(new Date().toISOString());

      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);

      // Coordinates are captured at the moment recording starts, not when the
      // form is submitted, so the stamp reflects where the footage was taken.
      if (!coords) captureLocation();
    } catch {
      toast.error('This browser cannot record in that format. Try Chrome or Safari.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) {
      toast.error('Start the camera first.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Could not capture that frame.');
          return;
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        setCaptured({
          blob,
          url: URL.createObjectURL(blob),
          name: `field-photo-${stamp}.jpg`,
          type: 'image/jpeg',
        });
        setCapturedAt(new Date().toISOString());
        if (!coords) captureLocation();
        toast.success('Photo captured.');
      },
      'image/jpeg',
      0.92
    );
  };

  const discard = () => {
    if (captured?.url) URL.revokeObjectURL(captured.url);
    setCaptured(null);
    setCapturedAt(null);
    setElapsed(0);
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!captured) {
      toast.error('Record or capture something first.');
      return;
    }
    if (!institutionId) {
      toast.error('Choose which institution this concerns.');
      return;
    }
    if (!title.trim()) {
      toast.error('Give the report a title.');
      return;
    }
    if (description.trim().length < 20) {
      toast.error('Describe what the recording shows — at least 20 characters.');
      return;
    }

    setSubmitting(true);

    const file = new File([captured.blob], captured.name, { type: captured.type });
    // Path is keyed by the uploader: the media bucket policy grants the uploader,
    // admins, and everyone once a report is published.
    const path = buildObjectPath(user.user_id, captured.name);
    const hash = await generateFileHash(file);

    const { path: storedPath, error: uploadError } = await uploadFile(
      STORAGE_BUCKETS.MEDIA_REPORTS,
      path,
      file
    );

    if (uploadError) {
      setSubmitting(false);
      toast.error(uploadError);
      return;
    }

    const capturedNote = [
      capturedAt ? `Captured ${new Date(capturedAt).toLocaleString('en-NG')}` : null,
      coords
        ? `GPS ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (±${Math.round(coords.accuracy)}m)`
        : 'No GPS fix recorded',
      `SHA-256 ${hash}`,
    ]
      .filter(Boolean)
      .join(' · ');

    const { error } = await createMediaReport({
      institution_id: institutionId,
      reporter_id: user.user_id,
      title: title.trim(),
      description: `${description.trim()}\n\n— ${capturedNote}`,
      media_type: mode === 'photo' ? 'photo' : mode,
      file_url: storedPath,
      gps_latitude: coords?.latitude,
      gps_longitude: coords?.longitude,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });

    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success('Report filed. An administrator will review it before it is published.');
    discard();
    setTitle('');
    setDescription('');
    setTags('');
    setInstitutionId('');
  };

  const institutionOptions = institutions.map((i) => ({
    value: i.id,
    label: `${i.name} — ${i.location}`,
  }));

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Field recording</h1>
        <p className="text-surface-500 mt-1">
          Capture footage on site. Time and location are stamped onto the report automatically, and
          the file is hashed so its integrity can be checked later.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-surface-900">Capture</h2>
                <div className="flex gap-1.5">
                  {(['video', 'audio', 'photo'] as CaptureMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={recording}
                      onClick={() => {
                        setMode(m);
                        discard();
                        void requestDevices(m);
                      }}
                      aria-pressed={mode === m}
                      className={
                        mode === m
                          ? 'rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                          : 'rounded-lg px-3 py-1.5 text-sm font-medium text-surface-600 hover:bg-surface-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                      }
                    >
                      {m === 'video' ? 'Video' : m === 'audio' ? 'Audio' : 'Photo'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="relative overflow-hidden rounded-xl bg-surface-900 aspect-video flex items-center justify-center">
                {captured ? (
                  captured.type.startsWith('image/') ? (
                    <img src={captured.url} alt="Captured frame" className="h-full w-full object-contain" />
                  ) : captured.type.startsWith('audio/') ? (
                    <div className="p-6 w-full">
                      <audio src={captured.url} controls className="w-full" />
                    </div>
                  ) : (
                    <video src={captured.url} controls className="h-full w-full object-contain" />
                  )
                ) : mode === 'audio' ? (
                  <div className="text-center text-surface-400 p-6">
                    <Mic size={48} className="mx-auto mb-3" />
                    <p className="text-sm">
                      {permissionState === 'granted'
                        ? recording
                          ? 'Recording audio…'
                          : 'Microphone ready'
                        : 'Microphone not started'}
                    </p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                    {permissionState !== 'granted' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-surface-400 bg-surface-900">
                        <Camera size={48} className="mb-3" />
                        <p className="text-sm">Camera not started</p>
                      </div>
                    )}
                  </>
                )}

                {recording && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-accent-600 px-3 py-1 text-xs font-medium text-white">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    REC {minutes}:{String(seconds).padStart(2, '0')}
                  </div>
                )}
              </div>

              {permissionState === 'denied' && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    Access to your camera or microphone was blocked. Grant permission in your
                    browser's site settings, then start it again.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {permissionState !== 'granted' ? (
                  <Button
                    onClick={() => void requestDevices(mode)}
                    loading={permissionState === 'requesting'}
                    icon={mode === 'audio' ? Mic : Video}
                  >
                    Start {mode === 'audio' ? 'microphone' : 'camera'}
                  </Button>
                ) : (
                  <>
                    {mode === 'photo' ? (
                      <Button onClick={takePhoto} icon={Camera} disabled={!!captured}>
                        Take photo
                      </Button>
                    ) : recording ? (
                      <Button variant="danger" onClick={stopRecording} icon={Square}>
                        Stop recording
                      </Button>
                    ) : (
                      <Button onClick={startRecording} icon={Video} disabled={!!captured}>
                        Start recording
                      </Button>
                    )}

                    {captured && (
                      <Button variant="ghost" onClick={discard} icon={RotateCcw}>
                        Discard &amp; retake
                      </Button>
                    )}
                  </>
                )}

                <Button
                  variant="outline"
                  onClick={captureLocation}
                  loading={locating}
                  icon={Crosshair}
                >
                  {coords ? 'Refresh location' : 'Capture location'}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                {coords ? (
                  <Badge variant="success">
                    <MapPin size={12} className="inline mr-1" />
                    {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} · ±
                    {Math.round(coords.accuracy)}m
                  </Badge>
                ) : (
                  <Badge variant="warning">No GPS fix</Badge>
                )}
                {capturedAt && (
                  <span className="text-xs text-surface-500">
                    Captured {new Date(capturedAt).toLocaleString('en-NG')}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <h2 className="font-semibold text-surface-900 flex items-center gap-2">
                <Building2 size={16} /> Report details
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {institutions.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner />
                </div>
              ) : (
                <Select
                  label="Institution"
                  options={institutionOptions}
                  placeholder="Which institution?"
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                  required
                />
              )}

              <Input
                label="Title"
                placeholder="e.g. Queue management at the licensing counter"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />

              <TextArea
                label="What does this show?"
                placeholder="Describe what you observed, when, and who was involved. Stick to what is visible in the recording."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                required
              />

              <Input
                label="Tags (comma separated)"
                placeholder="delays, staffing, access"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />

              <div className="rounded-lg bg-surface-50 border border-surface-200 p-3">
                <p className="text-xs text-surface-600">
                  Filed reports go to an administrator for review. Nothing is published to the public
                  archive until it is approved — this protects both the institution named and you.
                </p>
              </div>

              <Button
                onClick={() => void handleSubmit()}
                loading={submitting}
                disabled={submitting || !captured}
                icon={Upload}
                className="w-full"
              >
                File report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
