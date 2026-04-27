'use client';

import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type FacultyForm = {
  name: string;
  batch: string;
  branch: string;
  imageFile: File | null;
};

export default function AddFacultyModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FacultyForm) => void;
}) {
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FacultyForm>({
    name: '',
    batch: '',
    branch: '',
    imageFile: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCheckingFace, setIsCheckingFace] = useState(false);
  const [faceDetected, setFaceDetected] = useState<boolean | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const batches = ['CS Batch 2021-25', 'EC Batch 2021-25', 'ME Batch 2021-25', 'IT Batch 2021-25'];
  const branches = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Information Technology'];

  useEffect(() => {
    const loadModels = async () => {
      try {
        const base = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(base),
          faceapi.nets.ssdMobilenetv1.loadFromUri(base),
        ]);
        setModelsLoaded(true);
      } catch (e) {
        console.error('Failed to load face-api models in modal:', e);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 0);
      const onEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', onEsc);
      return () => document.removeEventListener('keydown', onEsc);
    }
  }, [isOpen, onClose]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setForm({ ...form, imageFile: file });
    setFaceDetected(null);
    setErrors((prev) => ({ ...prev, imageFile: '' }));

    if (file && file.type.startsWith('image/')) {
      setIsCheckingFace(true);
      try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));
        setFaceDetected(!!detection);
        if (!detection) {
          setErrors((prev) => ({ ...prev, imageFile: 'No clear face detected in this image. Please use a clear portrait.' }));
        }
      } catch (err) {
        console.error('Face detection error:', err);
      } finally {
        setIsCheckingFace(false);
      }
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Faculty name is required';
    if (!form.batch) next.batch = 'Select student batch';
    if (!form.branch) next.branch = 'Select branch';
    if (!form.imageFile) next.imageFile = 'Upload a faculty image';
    else if (!form.imageFile.type.startsWith('image/')) next.imageFile = 'File must be an image';
    else if (form.imageFile.size > 5 * 1024 * 1024) next.imageFile = 'Image must be under 5MB';
    else if (faceDetected === false) next.imageFile = 'No face detected. Please upload a clear photo.';
    
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(form);
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setForm({ name: '', batch: '', branch: '', imageFile: null });
    setErrors({});
    setFaceDetected(null);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-faculty-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900/90 border border-slate-700/50 rounded-2xl shadow-2xl w-[calc(100%-2rem)] sm:w-[600px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="add-faculty-title" className="text-xl sm:text-2xl font-bold text-white">Add Faculty</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1" htmlFor="faculty-name">Faculty Name</label>
            <input
              ref={firstInputRef}
              id="faculty-name"
              type="text"
              className="w-full rounded-xl bg-slate-800/60 border border-slate-700/60 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'faculty-name-error' : undefined}
            />
            {errors.name && <p id="faculty-name-error" className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1" htmlFor="faculty-batch">Student Batch</label>
              <select
                id="faculty-batch"
                className="w-full rounded-xl bg-slate-800/60 border border-slate-700/60 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.batch}
                onChange={(e) => setForm({ ...form, batch: e.target.value })}
                aria-invalid={!!errors.batch}
                aria-describedby={errors.batch ? 'faculty-batch-error' : undefined}
              >
                <option value="" disabled>Select Batch</option>
                {batches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {errors.batch && <p id="faculty-batch-error" className="text-red-400 text-xs mt-1">{errors.batch}</p>}
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1" htmlFor="faculty-branch">Branch</label>
              <select
                id="faculty-branch"
                className="w-full rounded-xl bg-slate-800/60 border border-slate-700/60 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                aria-invalid={!!errors.branch}
                aria-describedby={errors.branch ? 'faculty-branch-error' : undefined}
              >
                <option value="" disabled>Select Branch</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {errors.branch && <p id="faculty-branch-error" className="text-red-400 text-xs mt-1">{errors.branch}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1" htmlFor="faculty-image">Faculty Image</label>
            <div className="relative">
              <input
                id="faculty-image"
                type="file"
                accept="image/*"
                className="w-full rounded-xl bg-slate-800/60 border border-slate-700/60 text-white px-3 py-2 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                onChange={handleImageChange}
                aria-invalid={!!errors.imageFile}
                aria-describedby={errors.imageFile ? 'faculty-image-error' : undefined}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {isCheckingFace && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Detecting face...</span>
                  </div>
                )}
                {faceDetected === true && !isCheckingFace && (
                  <div className="flex items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Face detected</span>
                  </div>
                )}
                {faceDetected === false && !isCheckingFace && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>No face!</span>
                  </div>
                )}
              </div>
            </div>
            {errors.imageFile && <p id="faculty-image-error" className="text-red-400 text-xs mt-1">{errors.imageFile}</p>}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium shadow-lg hover:shadow-blue-500/25">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}