import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, MapPin, Building2, StickyNote, Upload } from 'lucide-react';
import {
  Button,
  Input,
  TextArea,
  FileUpload,
  Card,
  CardHeader,
  CardContent,
} from '@/components/ui';
import type { UploadedFile } from '@/components/ui';

export default function FieldRecordingPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [institutionName, setInstitutionName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-surface-900">Field Recording</h1>
          <p className="text-surface-600 mt-1">
            Capture field recordings during institutional visits
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-surface-900">
                  <Mic size={20} className="text-forest-600" />
                  Start Recording
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Institution Name"
                  placeholder="e.g. Central Police Station"
                  icon={Building2}
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                />
                <Input
                  label="Location"
                  placeholder="Auto-detect GPS (tap to edit)"
                  icon={MapPin}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  helperText="Location will be auto-detected when GPS is available"
                />
                <Button
                  variant={isRecording ? 'danger' : 'primary'}
                  icon={isRecording ? MicOff : Mic}
                  size="lg"
                  className="w-full"
                  onClick={() => setIsRecording(!isRecording)}
                >
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Button>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-accent-50 border border-accent-200"
                  >
                    <span className="w-3 h-3 rounded-full bg-accent-500 animate-pulse" />
                    <span className="text-sm font-medium text-accent-700">
                      Recording in progress...
                    </span>
                  </motion.div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-surface-900">
                  <StickyNote size={20} className="text-forest-600" />
                  Recording Notes
                </h2>
              </CardHeader>
              <CardContent>
                <TextArea
                  placeholder="Add notes about this recording session..."
                  rows={6}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-surface-900">
                  <Upload size={20} className="text-forest-600" />
                  Upload Recording
                </h2>
              </CardHeader>
              <CardContent>
                <FileUpload
                  accept="audio/*,video/*,.mp3,.wav,.mp4"
                  multiple
                  value={files}
                  onChange={setFiles}
                />
                {files.length > 0 && (
                  <div className="mt-4">
                    <Button variant="primary" className="w-full">
                      Submit Recording
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
