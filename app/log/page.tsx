'use client';

export default function LogPage() {
  return (
    <>
      {/* Background */}
      <div className="absolute inset-0">
        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 backdrop-blur-2xl bg-slate-950/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-4 sm:p-8 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Logs</h1>
        </div>

        {/* Body */}
        <div className="flex-1 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
          <div className="p-6">
            <div className="text-slate-300">Activity logs will appear here.</div>
          </div>
        </div>
      </div>
    </>
  );
}