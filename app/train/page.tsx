'use client';

import { useEffect, useState } from 'react';
import { Users, GraduationCap, Plus, UserPlus } from 'lucide-react';
import AddStudentModal from '../components/train/AddStudentModal';
import AddFacultyModal from '../components/train/AddFacultyModal';

// Lists will be populated from Supabase on mount

export default function TrainPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'students' | 'faculty'>('students');
  const [openStudent, setOpenStudent] = useState(false);
  const [openFaculty, setOpenFaculty] = useState(false);

  const handleAddStudent = () => setOpenStudent(true);
  const handleAddFaculty = () => setOpenFaculty(true);
  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, fRes] = await Promise.all([
          fetch('/api/train/students', { method: 'GET' }),
          fetch('/api/train/faculty', { method: 'GET' }),
        ]);
        const sJson = await sRes.json();
        const fJson = await fRes.json();
        if (sRes.ok && Array.isArray(sJson.students)) {
          setStudents(
            sJson.students.map((s: any) => ({
              id: s.id,
              image: s.image_url,
              name: s.name,
              enrollment: s.enrollment,
              year: s.year,
              branch: s.branch,
            }))
          );
        }
        if (fRes.ok && Array.isArray(fJson.faculty)) {
          setFaculty(
            fJson.faculty.map((f: any) => ({
              id: f.id,
              image: f.image_url,
              name: f.name,
              batch: f.batch,
              branch: f.branch,
            }))
          );
        }
      } catch (e) {
        console.error('Failed to load data', e);
      }
    };
    load();
  }, []);
  const submitStudent = async (data: { name: string; enrollment: string; year: string; branch: string; imageFile: File | null; }) => {
    const fd = new FormData();
    fd.append('name', data.name);
    fd.append('enrollment', data.enrollment);
    fd.append('year', data.year);
    fd.append('branch', data.branch);
    if (data.imageFile) fd.append('image', data.imageFile);

    try {
      const res = await fetch('/api/train/students', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      const s = json.student;
      setStudents((prev) => [
        ...prev,
        {
          id: s.id ?? (prev.length ? prev[prev.length - 1].id + 1 : 1),
          image: s.image_url,
          name: s.name,
          enrollment: s.enrollment,
          year: s.year,
          branch: s.branch,
        },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const submitFaculty = async (data: { name: string; batch: string; branch: string; imageFile: File | null; }) => {
    const fd = new FormData();
    fd.append('name', data.name);
    fd.append('batch', data.batch);
    fd.append('branch', data.branch);
    if (data.imageFile) fd.append('image', data.imageFile);

    try {
      const res = await fetch('/api/train/faculty', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      const f = json.faculty;
      setFaculty((prev) => [
        ...prev,
        {
          id: f.id ?? (prev.length ? prev[prev.length - 1].id + 1 : 1),
          image: f.image_url,
          name: f.name,
          batch: f.batch,
          branch: f.branch,
        },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      {/* Background Video with Blur */}
      <div className="absolute inset-0">
        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 backdrop-blur-2xl bg-slate-950/40" />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 p-4 sm:p-8 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <h1 className="text-4xl font-bold text-white">Train Faces</h1>
          <div className="flex gap-3">
            <button
              onClick={handleAddStudent}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg hover:shadow-blue-500/25"
            >
              <UserPlus className="w-4 h-4" />
              Add Student
            </button>
            <button
              onClick={handleAddFaculty}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg hover:shadow-purple-500/25"
            >
              <Plus className="w-4 h-4" />
              Add Faculty
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'students'
                ? 'bg-gradient-to-r from-green-500/20 to-green-600/10 border border-green-500/30 text-green-400'
                : 'bg-slate-900/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <GraduationCap className="w-5 h-5" />
            Students ({students.length})
          </button>
          <button
            onClick={() => setActiveTab('faculty')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'faculty'
                ? 'bg-gradient-to-r from-purple-500/20 to-purple-600/10 border border-purple-500/30 text-purple-400'
                : 'bg-slate-900/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-5 h-5" />
            Faculty ({faculty.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
          {activeTab === 'students' ? (
            <div className="p-6">
              <div className="space-y-4">
                {/* Header Row */}
                <div className="grid grid-cols-5 gap-4 pb-3 border-b border-slate-700/50 text-sm font-medium text-slate-400">
                  <div>Image</div>
                  <div>Name</div>
                  <div>Enrollment</div>
                  <div>Academic Year</div>
                  <div>Branch</div>
                </div>
                
                {/* Student Rows */}
                {students.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No students added yet</p>
                    <p className="text-sm mt-2">Click "Add Student" to get started</p>
                  </div>
                ) : (
                  students.map((student) => (
                    <div
                      key={student.id}
                      className="grid grid-cols-5 gap-4 py-4 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors rounded-lg px-2"
                    >
                      <div className="flex items-center">
                        {student.image ? (
                          <img src={student.image} alt={student.name} className="w-10 h-10 rounded-full object-cover border border-slate-700/60" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                            {student.name
                              ? student.name
                                  .split(' ')
                                  .map((n: string) => n?.[0] ?? '')
                                  .join('')
                              : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center text-white font-medium">
                        {student.name}
                      </div>
                      <div className="flex items-center text-slate-300 font-mono text-sm">
                        {student.enrollment}
                      </div>
                      <div className="flex items-center text-slate-300">
                        {student.year}
                      </div>
                      <div className="flex items-center text-slate-300">
                        {student.branch}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {/* Header Row */}
                <div className="grid grid-cols-4 gap-4 pb-3 border-b border-slate-700/50 text-sm font-medium text-slate-400">
                  <div>Image</div>
                  <div>Name</div>
                  <div>Student Batch</div>
                  <div>Branch</div>
                </div>
                
                {/* Faculty Rows */}
                {faculty.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No faculty added yet</p>
                    <p className="text-sm mt-2">Click "Add Faculty" to get started</p>
                  </div>
                ) : (
                  faculty.map((member) => (
                    <div
                      key={member.id}
                      className="grid grid-cols-4 gap-4 py-4 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors rounded-lg px-2"
                    >
                      <div className="flex items-center">
                        {member.image ? (
                          <img src={member.image} alt={member.name} className="w-10 h-10 rounded-full object-cover border border-slate-700/60" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-medium text-sm">
                            {member.name
                              ? member.name
                                  .split(' ')
                                  .map((n: string) => n?.[0] ?? '')
                                  .join('')
                              : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center text-white font-medium">
                        {member.name}
                      </div>
                      <div className="flex items-center text-slate-300">
                        {member.batch}
                      </div>
                      <div className="flex items-center text-slate-300">
                        {member.branch}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {/* Modals */}
        <AddStudentModal isOpen={openStudent} onClose={() => setOpenStudent(false)} onSubmit={submitStudent} />
        <AddFacultyModal isOpen={openFaculty} onClose={() => setOpenFaculty(false)} onSubmit={submitFaculty} />
      </div>
    </>
  );
}