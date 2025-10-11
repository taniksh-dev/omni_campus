'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, Car, GraduationCap, TrendingUp } from 'lucide-react';
import { FilesetResolver, ObjectDetector, Detection, FaceDetector } from '@mediapipe/tasks-vision';
import * as faceapi from 'face-api.js';

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isClient, setIsClient] = useState(false);
  const [peopleCount, setPeopleCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [facultyCount, setFacultyCount] = useState(0);
  const [unknownPersonCount, setUnknownPersonCount] = useState(0);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [campusStrength, setCampusStrength] = useState(0);
  const campusStrengthRef = useRef(0);
  const [recentDetections, setRecentDetections] = useState<{ label: string; time: string }[]>([]);
  const detectorRef = useRef<ObjectDetector | null>(null);
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  // Face recognition (face-api.js)
  const faceApiReadyRef = useRef(false);
  const faceMatcherRef = useRef<any>(null);
  const labeledDescriptorsRef = useRef<any[]>([]);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
    // Directional inference fields
    prevArea?: number;
    trendUpCount?: number;
    trendDownCount?: number;
    direction?: 'in' | 'out';
    countedDirection?: 'in' | 'out' | null;
    dirScore?: number; // accumulates evidence towards IN/OUT
    facingCameraCount?: number; // for person: consecutive face detections
    lastSignal?: 'in' | 'out' | null; // provisional signal for canvas
    // Recognition fields
    identity?: { name: string; role: 'Student' | 'Faculty' } | null;
    lastRecognition?: number;
    recognitionTries?: number;
    pendingMatch?: { label: string; role: 'Student' | 'Faculty'; distanceAvg: number; hits: number } | undefined;
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
        // Initialize face recognition (async, non-blocking)
        initFaceApi();
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
      // Initialize face detector for orientation (people only). Fails gracefully.
      try {
        faceDetectorRef.current = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face/float16/1/blaze_face.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
        } as any);
      } catch (fe) {
        console.warn('FaceDetector unavailable, falling back to motion/scale only.', fe);
      }
    } catch (e) {
      console.error('Failed to init MediaPipe ObjectDetector:', e);
    }
  };

  // Initialize face-api.js, load models and build labeled descriptors
  const initFaceApi = async () => {
    try {
      // Load models: prefer local /models if present, otherwise CDN
      const local = '/models';
      const cdn = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
      let base = cdn;
      try {
        const head = await fetch(`${local}/ssd_mobilenetv1_model-weights_manifest.json`, { method: 'HEAD' });
        if (head.ok) base = local;
      } catch (_) {}
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(base),
          faceapi.nets.ssdMobilenetv1.loadFromUri(base),
          faceapi.nets.faceLandmark68Net.loadFromUri(base),
          faceapi.nets.faceRecognitionNet.loadFromUri(base),
        ]);
        console.info('[FaceAPI] Loaded models from', base);
      } catch (e) {
        if (base !== cdn) {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(cdn),
            faceapi.nets.ssdMobilenetv1.loadFromUri(cdn),
            faceapi.nets.faceLandmark68Net.loadFromUri(cdn),
            faceapi.nets.faceRecognitionNet.loadFromUri(cdn),
          ]);
          console.info('[FaceAPI] Fallback: Loaded models from CDN');
        } else {
          throw e;
        }
      }

      // Load students/faculty and build labeled descriptors
      const [sRes, fRes] = await Promise.all([
        fetch('/api/train/students', { method: 'GET' }),
        fetch('/api/train/faculty', { method: 'GET' }),
      ]);
      const sJson = await sRes.json().catch(() => ({ students: [] }));
      const fJson = await fRes.json().catch(() => ({ faculty: [] }));
      const students = Array.isArray(sJson.students) ? sJson.students : [];
      const faculty = Array.isArray(fJson.faculty) ? fJson.faculty : [];
      const labeled: any[] = [];
      for (const s of students) {
        if (!s?.image_url || !s?.name) continue;
        try {
          const src = /^https?:\/\//.test(s.image_url)
            ? `/api/image-proxy?url=${encodeURIComponent(s.image_url)}`
            : s.image_url;
          const img = await faceapi.fetchImage(src);
          const det = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (det?.descriptor) {
            const lfd = new faceapi.LabeledFaceDescriptors(`${s.name} (Student)`, [det.descriptor]);
            labeled.push(lfd);
            console.info('[FaceAPI] Student descriptor built:', s.name);
          } else {
            const det2 = await faceapi
              .detectSingleFace(img)
              .withFaceLandmarks()
              .withFaceDescriptor();
            if (det2?.descriptor) {
              const lfd = new faceapi.LabeledFaceDescriptors(`${s.name} (Student)`, [det2.descriptor]);
              labeled.push(lfd);
              console.info('[FaceAPI] Student descriptor built (SSD):', s.name);
            } else {
              console.warn('[FaceAPI] No face found in student image:', s.name);
            }
          }
        } catch (e) {
          console.warn('[FaceAPI] Failed student image fetch/detect:', s?.name, e);
        }
      }
      for (const f of faculty) {
        if (!f?.image_url || !f?.name) continue;
        try {
          const src = /^https?:\/\//.test(f.image_url)
            ? `/api/image-proxy?url=${encodeURIComponent(f.image_url)}`
            : f.image_url;
          const img = await faceapi.fetchImage(src);
          const det = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (det?.descriptor) {
            const lfd = new faceapi.LabeledFaceDescriptors(`${f.name} (Faculty)`, [det.descriptor]);
            labeled.push(lfd);
            console.info('[FaceAPI] Faculty descriptor built:', f.name);
          } else {
            const det2 = await faceapi
              .detectSingleFace(img)
              .withFaceLandmarks()
              .withFaceDescriptor();
            if (det2?.descriptor) {
              const lfd = new faceapi.LabeledFaceDescriptors(`${f.name} (Faculty)`, [det2.descriptor]);
              labeled.push(lfd);
              console.info('[FaceAPI] Faculty descriptor built (SSD):', f.name);
            } else {
              console.warn('[FaceAPI] No face found in faculty image:', f.name);
            }
          }
        } catch (e) {
          console.warn('[FaceAPI] Failed faculty image fetch/detect:', f?.name, e);
        }
      }
      labeledDescriptorsRef.current = labeled;
      faceMatcherRef.current = new faceapi.FaceMatcher(labeled, 0.6);
      console.info('[FaceAPI] Labeled descriptors:', labeled.length);
      faceApiReadyRef.current = true;
    } catch (e) {
      console.warn('FaceAPI init failed, continuing without recognition.', e);
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
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }
      }

      let detections: Detection[] = [];
      try {
        const result = detectorRef.current.detectForVideo(video, performance.now());
        detections = result?.detections ?? [];
      } catch (err) {
        // Detector not ready or frame not suitable; skip this iteration
      }

      // Face detections for current frame (used to infer facing camera)
      let faceBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
      if (faceDetectorRef.current) {
        try {
          const faceRes = faceDetectorRef.current.detectForVideo(video, performance.now());
          const fds = (faceRes as any)?.detections ?? [];
          faceBoxes = fds
            .map((d: any) => d.boundingBox)
            .filter(Boolean)
            .map((bb: any) => ({ x: bb.originX, y: bb.originY, width: bb.width, height: bb.height }));
        } catch (_) {
          // ignore face detector failure
        }
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

          // Fused direction inference
          const center = { x: (vw || 640) / 2, y: (vh || 480) / 2 };
          const area = c.bbox.width * c.bbox.height;
          const prevArea = t.prevArea ?? area;
          const deltaRatio = (area - prevArea) / Math.max(prevArea, 1);
          t.prevArea = area;

          const prevCentroid = t.cx !== undefined && t.cy !== undefined ? { x: t.cx, y: t.cy } : centroid(t.bbox);
          const currCentroid = cC;
          const prevDist = Math.hypot(prevCentroid.x - center.x, prevCentroid.y - center.y);
          const currDist = Math.hypot(currCentroid.x - center.x, currCentroid.y - center.y);
          const distDelta = prevDist - currDist; // >0 means moving towards center

          const AREA_THRESH = 0.03;
          const DIST_DELTA_THRESH = Math.max(3, Math.min(vw || 640, vh || 480) * 0.002);
          const distSignal = distDelta > DIST_DELTA_THRESH ? 1 : distDelta < -DIST_DELTA_THRESH ? -1 : 0;
          const areaSignal = deltaRatio > AREA_THRESH ? 1 : deltaRatio < -AREA_THRESH ? -1 : 0;
          const inSignal = distSignal > 0 || areaSignal > 0;
          const outSignal = distSignal < 0 || areaSignal < 0;
          // Provisional label prefers stronger (radial) cue when available
          t.lastSignal = distSignal !== 0 ? (distSignal > 0 ? 'in' : 'out') : areaSignal !== 0 ? (areaSignal > 0 ? 'in' : 'out') : null;

          // Face evidence for person
          let faceEvidence = 0;
          if (t.type === 'person' && faceBoxes.length > 0) {
            const hasFace = faceBoxes.some((fb) => iou({ x: fb.x, y: fb.y, width: fb.width, height: fb.height }, t.bbox) > 0.15);
            if (hasFace) {
              t.facingCameraCount = (t.facingCameraCount ?? 0) + 1;
              faceEvidence = 1; // boost towards IN
            } else {
              t.facingCameraCount = Math.max(0, (t.facingCameraCount ?? 0) - 0.5);
            }
          }

          // Accumulate directional score: radial cue weighted strongest, area medium
          t.dirScore = (t.dirScore ?? 0) + (distSignal * 1) + (areaSignal * 0.6) + faceEvidence;
          // mild decay when no signal
          if (!inSignal && !outSignal && faceEvidence === 0) {
            t.dirScore = t.dirScore * 0.95;
          }

          // Decide when confirmed
          if (!t.direction && t.confirmed) {
            if ((t.dirScore ?? 0) >= 1.8) t.direction = 'in';
            else if ((t.dirScore ?? 0) <= -1.8) t.direction = 'out';
          }

          // Attempt face recognition for person tracks using face-api.js
          if (
            t.type === 'person' &&
            faceApiReadyRef.current &&
            !t.identity &&
            ((t.facingCameraCount ?? 0) >= 1 || t.confirmed)
          ) {
            const nowMs = Date.now();
            const last = t.lastRecognition ?? 0;
            const tries = t.recognitionTries ?? 0;
            if (nowMs - last > 800 && tries < 5) {
              t.lastRecognition = nowMs;
              t.recognitionTries = tries + 1;
              try {
                const off = offscreenCanvasRef.current!;
                // If we have a face box overlapping this track, crop around it; otherwise use upper-half person crop
                const overlappingFace = faceBoxes
                  .map((fb) => ({ fb, i: iou({ x: fb.x, y: fb.y, width: fb.width, height: fb.height }, t.bbox) }))
                  .sort((a, b) => b.i - a.i)[0];

                let srcX: number, srcY: number, srcW: number, srcH: number, cropLabel: string;
                if (overlappingFace && overlappingFace.i > 0.1) {
                  const margin = 0.25;
                  const fb = overlappingFace.fb as any;
                  const mx = Math.floor(fb.x - fb.width * margin);
                  const my = Math.floor(fb.y - fb.height * margin);
                  const mw = Math.floor(fb.width * (1 + margin * 2));
                  const mh = Math.floor(fb.height * (1 + margin * 2));
                  srcX = Math.max(0, mx);
                  srcY = Math.max(0, my);
                  srcW = Math.max(64, mw);
                  srcH = Math.max(64, mh);
                  cropLabel = 'face-box crop';
                } else {
                  srcX = Math.max(0, Math.floor(t.bbox.x));
                  srcY = Math.max(0, Math.floor(t.bbox.y));
                  srcW = Math.floor(t.bbox.width);
                  srcH = Math.floor(Math.max(128, t.bbox.height * 0.6));
                  cropLabel = 'person upper-half';
                }

                const w = Math.max(128, srcW);
                const h = Math.max(128, srcH);
                off.width = w;
                off.height = h;
                const octx = off.getContext('2d');
                if (octx) {
                  octx.clearRect(0, 0, w, h);
                  octx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, w, h);
                  console.debug('[FaceAPI] Recognition attempt using', cropLabel, 'src', { srcX, srcY, srcW, srcH });
                  // Try TinyFaceDetector first for better performance; bump inputSize to 320 for robustness
                  faceapi
                    .detectSingleFace(off, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
                    .withFaceLandmarks()
                    .withFaceDescriptor()
                    .then((det: any) => {
                      if (!det) {
                        // Fallback to SSD Mobilenet if tiny fails to detect
                        return faceapi
                          .detectSingleFace(off)
                          .withFaceLandmarks()
                          .withFaceDescriptor();
                      }
                      return det;
                    })
                    .then((det: any) => {
                      if (det?.descriptor && faceMatcherRef.current) {
                        const best = faceMatcherRef.current.findBestMatch(det.descriptor);
                        const distance = (best as any)?.distance ?? Infinity;
                        console.debug('[FaceAPI] Match result:', best?.label, 'distance:', distance);
                        if (best?.label && best.label !== 'unknown') {
                          const m = /^(.*)\s\((Student|Faculty)\)$/.exec(best.label);
                          const name = m ? m[1] : best.label;
                          const role = (m ? m[2] : 'Student') as 'Student' | 'Faculty';

                          // Multi-frame confirmation: require at least 2 consistent hits
                          if (!t.pendingMatch || t.pendingMatch.label !== best.label) {
                            t.pendingMatch = { label: best.label, role, distanceAvg: distance, hits: 1 };
                          } else {
                            const hits = (t.pendingMatch.hits ?? 0) + 1;
                            const avg = ((t.pendingMatch.distanceAvg ?? distance) * (hits - 1) + distance) / hits;
                            t.pendingMatch = { label: best.label, role, distanceAvg: avg, hits };
                          }

                          if (t.pendingMatch && t.pendingMatch.hits >= 2 && t.pendingMatch.distanceAvg <= 0.6) {
                            t.identity = { name, role };
                          }
                        } else {
                          // Unknown result resets pending to avoid sticky wrong labels
                          t.pendingMatch = undefined;
                        }
                      }
                      return det;
                    })
                    .catch(() => {});
                }
              } catch (_) {}
            }
          }

          // Count campus strength once per track when direction becomes known
          if (t.direction && !t.countedDirection) {
            if (t.direction === 'in') {
              campusStrengthRef.current = campusStrengthRef.current + 1;
              // Log only incoming objects to Recent Detections
              const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const whoLabel =
                t.type === 'person'
                  ? t.identity
                    ? `${t.identity.name} (${t.identity.role})`
                    : 'person'
                  : 'vehicle';
              const entry = { label: `${whoLabel} IN`, time: ts };
              setRecentDetections((prev) => {
                const next = [entry, ...prev];
                return next.slice(0, 20); // increase list capacity
              });
            } else {
              campusStrengthRef.current = Math.max(0, campusStrengthRef.current - 1);
            }
            t.countedDirection = t.direction;
            setCampusStrength(campusStrengthRef.current);
          }
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
              prevArea: c.bbox.width * c.bbox.height,
              trendUpCount: 0,
              trendDownCount: 0,
              direction: undefined,
              countedDirection: null,
              dirScore: 0,
              facingCameraCount: 0,
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
      const students = aliveTracks.filter((t) => t.type === 'person' && t.confirmed && t.identity?.role === 'Student').length;
      const faculty = aliveTracks.filter((t) => t.type === 'person' && t.confirmed && t.identity?.role === 'Faculty').length;
      const unknownPersons = aliveTracks.filter((t) => t.type === 'person' && t.confirmed && !t.identity).length;
      const vehicles = aliveTracks.filter((t) => t.type === 'vehicle' && t.confirmed).length;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        aliveTracks.forEach((t) => {
          const baseLabel =
            t.type === 'person'
              ? t.identity
                ? `${t.identity.name} (${t.identity.role})`
                : 'person'
              : 'vehicle';
          // Colors: person = blue, vehicle = green
          ctx.strokeStyle = t.type === 'person' ? '#3b82f6' : '#22c55e';
          ctx.lineWidth = 4;
          ctx.strokeRect(t.bbox.x, t.bbox.y, t.bbox.width, t.bbox.height);

          // Draw label background and text
          ctx.font = '12px sans-serif';
          const text = t.direction
            ? `${baseLabel} ${t.direction === 'in' ? 'IN' : 'OUT'}`
            : t.lastSignal
            ? `${baseLabel} ${t.lastSignal.toUpperCase()}?`
            : baseLabel;
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
          setStudentCount(students);
          setFacultyCount(faculty);
          setUnknownPersonCount(unknownPersons);
          setVehiclesCount(vehicles);
          // Recent detections now logged only on confirmed IN events above

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
                    <div className="text-xl font-bold text-white">{campusStrength}</div>
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
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
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
                <div className="text-3xl font-bold text-white">{studentCount}</div>
              </div>
              <div className="text-sm text-slate-300 font-medium">Students Count</div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-xl rounded-2xl p-6 border border-blue-500/30 shadow-xl hover:shadow-blue-500/20 transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <Users className="w-8 h-8 text-blue-400" />
                <div className="text-3xl font-bold text-white">{facultyCount}</div>
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
                <div className="text-3xl font-bold text-white">{studentCount + facultyCount + unknownPersonCount + vehiclesCount}</div>
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