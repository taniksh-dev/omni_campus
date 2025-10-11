'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Calendar, Filter } from 'lucide-react';

type DetectionLog = {
  id: string;
  type: 'student' | 'faculty' | 'vehicle' | 'unknown';
  timestamp: string;
  // Student fields
  name?: string;
  enrollment?: string;
  year?: string;
  branch?: string;
  // Faculty fields
  batch?: string;
  // Vehicle fields
  vehicleType?: '2-wheeler' | '4-wheeler' | 'bus';
};

export default function LogPage() {
  const [logs, setLogs] = useState<DetectionLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedType, setSelectedType] = useState<'all' | 'student' | 'faculty' | 'vehicle' | 'unknown'>('all');
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        type: selectedType,
      });
      const response = await fetch(`/api/logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [selectedDate, selectedType]);

  const handleRefresh = () => {
    loadLogs();
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderLogRow = (log: DetectionLog) => {
    switch (log.type) {
      case 'student':
        return (
          <div key={log.id} className="grid grid-cols-5 gap-4 py-3 border-b border-slate-700/30 text-sm">
            <div className="text-white font-medium">{log.name || 'Unknown'}</div>
            <div className="text-slate-300">{log.enrollment || 'N/A'}</div>
            <div className="text-slate-300">{log.year || 'N/A'}</div>
            <div className="text-slate-300">{log.branch || 'N/A'}</div>
            <div className="text-slate-400">{formatTime(log.timestamp)}</div>
          </div>
        );
      case 'faculty':
        return (
          <div key={log.id} className="grid grid-cols-4 gap-4 py-3 border-b border-slate-700/30 text-sm">
            <div className="text-white font-medium">{log.name || 'Unknown'}</div>
            <div className="text-slate-300">{log.batch || 'N/A'}</div>
            <div className="text-slate-300">{log.branch || 'N/A'}</div>
            <div className="text-slate-400">{formatTime(log.timestamp)}</div>
          </div>
        );
      case 'vehicle':
        return (
          <div key={log.id} className="grid grid-cols-2 gap-4 py-3 border-b border-slate-700/30 text-sm">
            <div className="text-white font-medium">
              {log.vehicleType ? log.vehicleType.charAt(0).toUpperCase() + log.vehicleType.slice(1) : 'Unknown Vehicle'}
            </div>
            <div className="text-slate-400">{formatTime(log.timestamp)}</div>
          </div>
        );
      case 'unknown':
        return (
          <div key={log.id} className="grid grid-cols-2 gap-4 py-3 border-b border-slate-700/30 text-sm">
            <div className="text-white font-medium">Unknown Person</div>
            <div className="text-slate-400">{formatTime(log.timestamp)}</div>
          </div>
        );
      default:
        return null;
    }
  };

  const getHeaderColumns = () => {
    switch (selectedType) {
      case 'student':
        return ['Name', 'Enrollment', 'Academic Year', 'Branch', 'Time'];
      case 'faculty':
        return ['Name', 'Student Batch', 'Branch', 'Time'];
      case 'vehicle':
        return ['Vehicle Type', 'Time'];
      case 'unknown':
        return ['Type', 'Time'];
      default:
        return ['Detection', 'Details', 'Time'];
    }
  };

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <h1 className="text-4xl font-bold text-white">Detection Logs</h1>
          
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-800/60 border border-slate-700/60 text-white px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="bg-slate-800/60 border border-slate-700/60 text-white px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="student">Students</option>
                <option value="faculty">Faculty</option>
                <option value="vehicle">Vehicles</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg hover:shadow-blue-500/25"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
          <div className="p-6">
            {/* Header Row */}
            {selectedType !== 'all' && (
              <div className={`grid ${
                selectedType === 'student' ? 'grid-cols-5' : 
                selectedType === 'faculty' ? 'grid-cols-4' : 
                'grid-cols-2'
              } gap-4 pb-3 border-b border-slate-700/50 text-sm font-medium text-slate-400 mb-4`}>
                {getHeaderColumns().map((header, index) => (
                  <div key={index}>{header}</div>
                ))}
              </div>
            )}

            {/* Logs List */}
            <div className="space-y-1">
              {loading ? (
                <div className="text-center py-12 text-slate-500">
                  <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin opacity-50" />
                  <p>Loading detection logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <div className="w-12 h-12 mx-auto mb-4 opacity-50 bg-slate-700 rounded-full flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <p>No detection logs found</p>
                  <p className="text-sm mt-2">
                    {selectedType === 'all' 
                      ? `No detections recorded for ${selectedDate}`
                      : `No ${selectedType} detections for ${selectedDate}`
                    }
                  </p>
                </div>
              ) : (
                logs.map(renderLogRow)
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}