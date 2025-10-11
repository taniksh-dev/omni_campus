'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, Car, GraduationCap, TrendingUp } from 'lucide-react';

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  

  useEffect(() => {
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
    };
  }, []);

  

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
      <div className="relative z-10 p-8 h-full flex flex-col">
          {/* Top Bar */}
          <div className="flex gap-4 mb-6">
            {/* Camera Component */}
            <div className="relative group flex-[2] min-w-[980px]">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
              <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-2 border border-slate-700/50 shadow-2xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-[70vh] object-cover rounded-xl"
                />
                <div className="absolute top-4 left-4 bg-red-500 w-3 h-3 rounded-full animate-pulse" />
                <div className="absolute top-4 left-9 text-white text-xs font-semibold bg-black/50 px-2 py-1 rounded">LIVE</div>
              </div>
            </div>

            {/* Info Panel */}
            <div className="flex-none w-[320px] space-y-4">
              {/* Date, Time & Campus Strength */}
              <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 border border-slate-700/50 shadow-xl">
                <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <div>
                    <div className="text-2xl font-bold text-white mb-1 whitespace-nowrap leading-tight">
                      {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="text-xs text-slate-400">
                      {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 px-4 py-2 rounded-xl w-[120px]">
                    <div className="text-[10px] text-blue-100 mb-1">Campus Strength</div>
                    <div className="text-xl font-bold text-white">0</div>
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
                  <div className="text-slate-500 text-sm text-center py-4">No detections yet</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mt-auto">
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 shadow-xl hover:shadow-green-500/20 transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <GraduationCap className="w-8 h-8 text-green-400" />
                <div className="text-3xl font-bold text-white">0</div>
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
                <div className="text-3xl font-bold text-white">0</div>
              </div>
              <div className="text-sm text-slate-300 font-medium">Vehicles Count</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30 shadow-xl hover:shadow-purple-500/20 transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-8 h-8 text-purple-400" />
                <div className="text-3xl font-bold text-white">0</div>
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