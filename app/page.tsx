'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, Car, GraduationCap, TrendingUp } from 'lucide-react';
import { FilesetResolver, ObjectDetector, Detection } from '@mediapipe/tasks-vision';

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isClient, setIsClient] = useState(false);
  const [peopleCount, setPeopleCount] = useState(0);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [recentDetections, setRecentDetections] = useState<{ label: string; time: string }[]>([]);
  const detectorRef = useRef<ObjectDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const originalInfoRef = useRef<typeof console.info | null>(null);
  type Track = {
    id: number;
    type: 'person' | 'vehicle';
    bbox: { x: number; y: number; width: number; height: number };
    lastSeen: number;
    missed: number;
    consecutiveHits: number;
    confirmed: boolean;
    cx?: number;
    cy?: number;
    vx?: number;
    vy?: number;
  };
  const tracksRef = useRef<Track[]>([]);
  const nextIdRef = useRef(1);
  

  useEffect(() => {
    setIsClient(true);
    // Access camera
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: 1280, height: 720 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        if (bgVideoRef.current) {
          bgVideoRef.current.srcObject = stream;
        }

        // Wait until video metadata (dimensions) is ready
        await waitForVideoReady();
        // Temporarily mute TFLite XNNPACK info logs during first init
        muteXnnpackLogs(3000);
        // Initialize MediaPipe Object Detector once video is ready
        await initDetector();
        startDetectionLoop();
      } catch (err) {
        console.error('Camera access error:', err);
      }
    };

    startCamera();

    // Update time
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detectorRef.current?.close();
      // Restore console.info if still muted
      if (originalInfoRef.current) {
        console.info = originalInfoRef.current;
        originalInfoRef.current = null;
      }
    };
  }, []);

  const waitForVideoReady = () =>
    new Promise<void>((resolve) => {
      const v = videoRef.current;
      if (!v) return resolve();
      if (v.readyState >= 2) return resolve();
      const handler = () => {
        v.removeEventListener('loadedmetadata', handler);
        resolve();
      };
      v.addEventListener('loadedmetadata', handler, { once: true });
    });

  const initDetector = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      detectorRef.current = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
          delegate: 'GPU',
        },
        scoreThreshold: 0.5,
        maxResults: 20,
        runningMode: 'VIDEO',
      });
    } catch (e) {
      console.error('Failed to init MediaPipe ObjectDetector:', e);
    }
  };

  const muteXnnpackLogs = (ms = 3000) => {
    if (originalInfoRef.current) return; // already muted
    originalInfoRef.current = console.info;
    console.info = (...args: any[]) => {
      if (typeof args[0] === 'string' && args[0].includes('TensorFlow Lite XNNPACK')) {
        return; // suppress noisy delegate info
      }
      originalInfoRef.current?.(...args as [any]);
    };
    setTimeout(() => {
      if (originalInfoRef.current) {
        console.info = originalInfoRef.current;
        originalInfoRef.current = null;
      }
    }, ms);
  };

  const allowedVehicleLabels = new Set([
    'car',
    'truck',
    'bus',
    'motorcycle',
    'bicycle',
    'motorbike', // sometimes used
  ]);

  const iou = (a: Track['bbox'], b: Track['bbox']) => {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const union = a.width * a.height + b.width * b.height - inter;
    return union > 0 ? inter / union : 0;
  };

  const centroid = (b: { x: number; y: number; width: number; height: number }) => ({
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
  });

  const startDetectionLoop = () => {
    const loop = () => {
      if (!videoRef.current || !detectorRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Ensure canvas matches video resolution
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw && vh) {
        if (canvas.width !== vw) canvas.width = vw;
        if (canvas.height !== vh) canvas.height = vh;
      }

      let detections: Detection[] = [];
      try {
        const result = detectorRef.current.detectForVideo(video, performance.now());
        detections = result?.detections ?? [];
      } catch (err) {
        // Detector not ready or frame not suitable; skip this iteration
      }

      // Build candidates only for person and vehicles
      const candidates: Array<{ type: 'person' | 'vehicle'; bbox: { x: number; y: number; width: number; height: number }; score: number }> = [];
      detections.forEach((d) => {
        const cat = d.categories?.[0];
        if (!cat) return;
        const label = (cat.categoryName || '').toLowerCase();
        const score = cat.score ?? 0;
        if (score < 0.6) return; // higher confidence to reduce duplicates
        const bb = d.boundingBox as any;
        if (!bb) return;
        const bbox = { x: bb.originX, y: bb.originY, width: bb.width, height: bb.height };
        if (label === 'person') {
          candidates.push({ type: 'person', bbox, score });
        } else if (allowedVehicleLabels.has(label)) {
          candidates.push({ type: 'vehicle', bbox, score });
        }
      });

      // Non-Maximum Suppression (per type) to merge overlapping detections
      const nms = (items: typeof candidates, iouThresh = 0.5) => {
        const out: typeof candidates = [];
        const sorted = items.slice().sort((a, b) => b.score - a.score);
        sorted.forEach((c) => {
          const keep = out.every((o) => {
            if (o.type !== c.type) return true;
            const x1 = Math.max(o.bbox.x, c.bbox.x);
            const y1 = Math.max(o.bbox.y, c.bbox.y);
            const x2 = Math.min(o.bbox.x + o.bbox.width, c.bbox.x + c.bbox.width);
            const y2 = Math.min(o.bbox.y + o.bbox.height, c.bbox.y + c.bbox.height);
            const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
            const union = o.bbox.width * o.bbox.height + c.bbox.width * c.bbox.height - inter;
            const iouVal = union > 0 ? inter / union : 0;
            return iouVal < iouThresh;
          });
          if (keep) out.push(c);
        });
        return out;
      };
      const candidatesNms = nms(candidates, 0.5);

      // Associate candidates with existing tracks to avoid double counting
      const IOU_THRESH = 0.65; // stricter association to keep identity stable
      const MAX_MISSED = 15; // allow brief occlusions without dropping tracks
      const COOLDOWN_MS = 300; // avoid creating new tracks too soon near existing ones
      const DIST_THRESH = Math.max(30, Math.min(vw || 640, vh || 480) * 0.06); // pixel gating by screen size
      const now = Date.now();
      const tracks = tracksRef.current.slice();
      const usedTrackIds = new Set<number>();
      const newTracks: Track[] = [];

      candidatesNms.forEach((c) => {
        let bestId = -1;
        let bestScore = 0;
        for (let i = 0; i < tracks.length; i++) {
          const t = tracks[i];
          if (t.type !== c.type) continue;
          if (usedTrackIds.has(t.id)) continue;
          const iouVal = iou(t.bbox, c.bbox);
          let score = 0;
          let valid = false;
          if (iouVal >= IOU_THRESH) {
            score = iouVal;
            valid = true;
          } else {
            // Distance gating using predicted position
            const dtSec = Math.max((now - t.lastSeen) / 1000, 0.016);
            const prevC = t.cx !== undefined && t.cy !== undefined ? { x: t.cx, y: t.cy } : centroid(t.bbox);
            const predCx = prevC.x + (t.vx ?? 0) * dtSec;
            const predCy = prevC.y + (t.vy ?? 0) * dtSec;
            const candC = centroid(c.bbox);
            const dist = Math.hypot(candC.x - predCx, candC.y - predCy);
            if (dist <= DIST_THRESH) {
              // Higher score for closer distance
              score = 1 - dist / DIST_THRESH;
              valid = true;
            }
          }
          if (valid && score > bestScore) {
            bestScore = score;
            bestId = i;
          }
        }
        if (bestId !== -1) {
          // Update existing track
          const t = tracks[bestId];
          // Smooth bbox to reduce jitter
          const alpha = 0.6;
          t.bbox = {
            x: t.bbox.x * (1 - alpha) + c.bbox.x * alpha,
            y: t.bbox.y * (1 - alpha) + c.bbox.y * alpha,
            width: t.bbox.width * (1 - alpha) + c.bbox.width * alpha,
            height: t.bbox.height * (1 - alpha) + c.bbox.height * alpha,
          };
          // Update centroid and velocity
          const cC = centroid(c.bbox);
          const prevC = t.cx !== undefined && t.cy !== undefined ? { x: t.cx, y: t.cy } : centroid(t.bbox);
          const dtSec = Math.max((now - t.lastSeen) / 1000, 0.016);
          const instVx = (cC.x - prevC.x) / dtSec;
          const instVy = (cC.y - prevC.y) / dtSec;
          const vAlpha = 0.5;
          t.vx = (t.vx ?? instVx) * (1 - vAlpha) + instVx * vAlpha;
          t.vy = (t.vy ?? instVy) * (1 - vAlpha) + instVy * vAlpha;
          t.cx = cC.x;
          t.cy = cC.y;
          t.lastSeen = now;
          t.missed = 0;
          t.consecutiveHits = (t.consecutiveHits ?? 0) + 1;
          if (!t.confirmed && t.consecutiveHits >= 2) t.confirmed = true; // confirm after 2 consecutive hits
          usedTrackIds.add(t.id);
        } else {
          // Create new track
          const candC = centroid(c.bbox);
          const nearRecent = tracks.some((t) => t.type === c.type && (now - t.lastSeen) < COOLDOWN_MS && Math.hypot((t.cx ?? centroid(t.bbox).x) - candC.x, (t.cy ?? centroid(t.bbox).y) - candC.y) <= DIST_THRESH);
          if (!nearRecent) {
            const track: Track = {
              id: nextIdRef.current++,
              type: c.type,
              bbox: c.bbox,
              lastSeen: now,
              missed: 0,
              consecutiveHits: 1,
              confirmed: false,
              cx: candC.x,
              cy: candC.y,
              vx: 0,
              vy: 0,
            };
            tracks.push(track);
            newTracks.push(track);
            usedTrackIds.add(track.id);
          }
        }
      });

      // Age unmatched tracks
      tracks.forEach((t) => {
        if (!usedTrackIds.has(t.id)) {
          t.missed += 1;
          // If not yet confirmed, reset consecutive hits on a miss so it needs re-confirmation
          if (!t.confirmed) t.consecutiveHits = 0;
        }
      });
      const aliveTracks = tracks.filter((t) => t.missed <= MAX_MISSED);
      tracksRef.current = aliveTracks;

      // Update counts from active tracks
      const people = aliveTracks.filter((t) => t.type === 'person' && t.confirmed).length;
      const vehicles = aliveTracks.filter((t) => t.type === 'vehicle' && t.confirmed).length;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        aliveTracks.forEach((t) => {
          const label = t.type === 'person' ? 'person' : 'vehicle';
          // Colors: person = blue, vehicle = green
          ctx.strokeStyle = t.type === 'person' ? '#3b82f6' : '#22c55e';
          ctx.lineWidth = 4;
          ctx.strokeRect(t.bbox.x, t.bbox.y, t.bbox.width, t.bbox.height);

          // Draw label background and text
          ctx.font = '12px sans-serif';
          const text = label;
          const textWidth = ctx.measureText(text).width;
          const padX = 6;
          const padY = 4;
          const bgX = t.bbox.x;
          const bgY = Math.max(0, t.bbox.y - 18);
          const bgW = textWidth + padX * 2;
          const bgH = 16;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(bgX, bgY, bgW, bgH);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, bgX + padX, bgY + bgH - padY);
        });
      }

      // Update counts and recent list
      setPeopleCount(people);
      setVehiclesCount(vehicles);
      if (newTracks.length > 0) {
        setRecentDetections((prev) => {
          const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const labels = newTracks
            .map((t) => (t.type === 'person' ? 'person' : 'vehicle'))
            .reduce((acc, l) => ({ ...acc, [l]: (acc as any)[l] ? (acc as any)[l] + 1 : 1 }), {} as any);
          const labelText = `${labels.person ? labels.person : 0} person, ${labels.vehicle ? labels.vehicle : 0} vehicle`;
          const entry = { label: labelText, time: ts };
          const next = [entry, ...prev];
          return next.slice(0, 10);
        });
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  

  return (
    <>
      {/* Background Video with Blur */}
      <div className="absolute inset-0">
        <video
          ref={bgVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 backdrop-blur-2xl bg-slate-950/40" />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 p-4 sm:p-8 h-full flex flex-col">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Camera Component */}
            <div className="relative group flex-1 min-w-0">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
            <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-2 border border-slate-700/50 shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-[60vh] sm:h-[70vh] object-cover rounded-xl"
              />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-xl pointer-events-none" />
              <div className="absolute top-2 left-2 sm:top-4 sm:left-4 text-white text-xs font-semibold bg-black/50 px-2 py-1 rounded animate-pulse">LIVE</div>
            </div>
          </div>

            {/* Info Panel */}
            <div className="flex-none w-full sm:w-[320px] space-y-4">
              {/* Date, Time & Campus Strength */}
              <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 border border-slate-700/50 shadow-xl">
                <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <div>
                    <div className="text-2xl font-bold text-white mb-1 whitespace-nowrap leading-tight" suppressHydrationWarning>
                      {isClient ? currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—:—:—'}
                    </div>
                    <div className="text-xs text-slate-400" suppressHydrationWarning>
                      {isClient ? currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 px-4 py-2 rounded-xl w-[120px]">
                    <div className="text-[10px] text-blue-100 mb-1">Campus Strength</div>
                    <div className="text-xl font-bold text-white">{peopleCount}</div>
                  </div>
                </div>
              </div>

              {/* Recent Detections */}
              <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    Recent Detections
                  </h3>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {recentDetections.length === 0 ? (
                    <div className="text-slate-500 text-sm text-center py-4">No detections yet</div>
                  ) : (
                    recentDetections.map((d, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-300 bg-slate-800/50 px-3 py-2 rounded">
                        <span>{d.label}</span>
                        <span className="text-slate-500">{d.time}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-auto">
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 shadow-xl hover:shadow-green-500/20 transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <GraduationCap className="w-8 h-8 text-green-400" />
                <div className="text-3xl font-bold text-white">{peopleCount}</div>
              </div>
              <div className="text-sm text-slate-300 font-medium">Students Count</div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-xl rounded-2xl p-6 border border-blue-500/30 shadow-xl hover:shadow-blue-500/20 transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <Users className="w-8 h-8 text-blue-400" />
                <div className="text-3xl font-bold text-white">0</div>
              </div>
              <div className="text-sm text-slate-300 font-medium">Faculty Count</div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 backdrop-blur-xl rounded-2xl p-6 border border-yellow-500/30 shadow-xl hover:shadow-yellow-500/20 transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <Car className="w-8 h-8 text-yellow-400" />
                <div className="text-3xl font-bold text-white">{vehiclesCount}</div>
              </div>
              <div className="text-sm text-slate-300 font-medium">Vehicles Count</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30 shadow-xl hover:shadow-purple-500/20 transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-8 h-8 text-purple-400" />
                <div className="text-3xl font-bold text-white">{peopleCount + vehiclesCount}</div>
              </div>
              <div className="text-sm text-slate-300 font-medium">Total</div>
            </div>
          </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.7);
        }
      `}</style>
    </>
  );
}