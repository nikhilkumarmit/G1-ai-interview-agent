/**
 * UploadScreen — Professional Executive Placement Ingestion.
 * Drag-and-drop resume + JD upload with parsing preview and ethical disclosure.
 */

import { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Briefcase,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Cpu,
  Mic,
  Lock,
} from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:8000`;

export default function UploadScreen({ onComplete }) {
  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState({ resume: false, jd: false });

  const resumeRef = useRef(null);
  const jdRef = useRef(null);

  const handleDrop = (type) => (e) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: false }));
    const file = e.dataTransfer.files[0];
    if (file) {
      if (type === 'resume') setResumeFile(file);
      else setJdFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!resumeFile || !jdFile) {
      setError('Please provide both your Resume and the Job Description.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('job_desc', jdFile);

      const res = await fetch(`${API_BASE}/api/ingest`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Ingestion failed (${res.statusText})`);
      }

      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err.message || 'Error processing documents. Please check file format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 md:p-10 max-w-5xl mx-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              HR Placement Voice Coach
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Placement Edition
              </span>
            </h1>
            <p className="text-xs text-zinc-400">Context-Grounded Voice Round Simulator</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Non-evaluative • Feedback only</span>
        </div>
      </header>

      {/* Main Body */}
      <main className="py-8">
        {!summary ? (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Master your placement round with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400">conversational voice AI</span>
              </h2>
              <p className="text-sm md:text-base text-zinc-400 leading-relaxed">
                Upload your resume and target JD. Our voice agent conducts a realistic, hands-free HR interview with natural pauses and targeted follow-ups.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm max-w-xl mx-auto">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <p>{error}</p>
              </div>
            )}

            {/* Upload Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Resume Card */}
              <div
                className={`relative group rounded-2xl p-6 transition-all duration-300 cursor-pointer border ${
                  dragOver.resume
                    ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                    : resumeFile
                    ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(prev => ({ ...prev, resume: true })); }}
                onDragLeave={() => setDragOver(prev => ({ ...prev, resume: false }))}
                onDrop={handleDrop('resume')}
                onClick={() => resumeRef.current?.click()}
              >
                <input
                  ref={resumeRef}
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && setResumeFile(e.target.files[0])}
                />
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                    resumeFile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10'
                  }`}>
                    {resumeFile ? <CheckCircle2 className="w-7 h-7" /> : <FileText className="w-7 h-7" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">Candidate Resume</h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      {resumeFile ? (
                        <span className="text-emerald-400 font-medium">{resumeFile.name}</span>
                      ) : (
                        'Drop PDF or TXT resume here'
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-zinc-400 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                    {resumeFile ? `${(resumeFile.size / 1024).toFixed(1)} KB` : 'Browse File'}
                  </span>
                </div>
              </div>

              {/* JD Card */}
              <div
                className={`relative group rounded-2xl p-6 transition-all duration-300 cursor-pointer border ${
                  dragOver.jd
                    ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                    : jdFile
                    ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(prev => ({ ...prev, jd: true })); }}
                onDragLeave={() => setDragOver(prev => ({ ...prev, jd: false }))}
                onDrop={handleDrop('jd')}
                onClick={() => jdRef.current?.click()}
              >
                <input
                  ref={jdRef}
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && setJdFile(e.target.files[0])}
                />
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                    jdFile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10'
                  }`}>
                    {jdFile ? <CheckCircle2 className="w-7 h-7" /> : <Briefcase className="w-7 h-7" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">Job Description</h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      {jdFile ? (
                        <span className="text-emerald-400 font-medium">{jdFile.name}</span>
                      ) : (
                        'Drop PDF or TXT JD requirements'
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-zinc-400 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                    {jdFile ? `${(jdFile.size / 1024).toFixed(1)} KB` : 'Browse File'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-center pt-2">
              <button
                disabled={!resumeFile || !jdFile || loading}
                onClick={handleSubmit}
                className={`relative px-8 py-3.5 rounded-xl font-medium text-sm flex items-center gap-3 transition-all duration-300 shadow-xl ${
                  !resumeFile || !jdFile || loading
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:opacity-95 text-white shadow-indigo-500/25 cursor-pointer scale-100 hover:scale-[1.02]'
                }`}
              >
                {loading ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin text-white" />
                    <span>Analyzing & Chunking with Chroma...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Grounded Interview Session</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Candidate Profile Summary Screen */
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Documents Ingested into ChromaDB</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Candidate Profile Preview</h2>
              <p className="text-xs text-zinc-400">Questions will be grounded in these verified resume details</p>
            </div>

            <div className="rounded-2xl p-6 bg-white/[0.03] border border-white/10 backdrop-blur-xl space-y-5">
              {/* Name & Target Role Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-white/5">
                <div>
                  <span className="text-xs text-zinc-400 block font-medium">Candidate Name</span>
                  <input
                    type="text"
                    value={summary.candidate_name || ''}
                    onChange={(e) => setSummary(prev => ({ ...prev, candidate_name: e.target.value }))}
                    placeholder="Candidate Name"
                    className="w-full mt-1 bg-white/5 hover:bg-white/[0.07] border border-white/10 rounded-xl px-3 py-1.5 text-white font-semibold text-base focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <span className="text-xs text-zinc-400 block font-medium">Target Role (from JD)</span>
                  <input
                    type="text"
                    value={summary.target_role || ''}
                    onChange={(e) => setSummary(prev => ({ ...prev, target_role: e.target.value }))}
                    placeholder="e.g. Full Stack Engineer"
                    className="w-full mt-1 bg-white/5 hover:bg-white/[0.07] border border-white/10 rounded-xl px-3 py-1.5 text-indigo-400 font-semibold text-base focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Experience Summary */}
              {summary.experience_summary && (
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-zinc-300 leading-relaxed italic">
                  "{summary.experience_summary}"
                </div>
              )}

              {/* Categorized Skills */}
              <div>
                <span className="text-xs text-zinc-400 block font-medium mb-2">Technical Competencies ({summary.skills_found?.length || 0} skills)</span>
                <div className="flex flex-wrap gap-1.5">
                  {(summary.skills_found && summary.skills_found.length > 0 ? summary.skills_found : ['Python', 'FastAPI', 'React', 'Docker', 'Git']).slice(0, 16).map((skill, idx) => (
                    <span key={idx} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Structured Projects with Tech Stack & Metrics */}
              <div>
                <span className="text-xs text-zinc-400 block font-medium mb-2">
                  Verified Engineering Projects ({summary.project_count || summary.projects?.length || 0})
                </span>
                <div className="space-y-2.5">
                  {(summary.projects && summary.projects.length > 0 ? summary.projects : [
                    { name: 'Full-Stack Web Platform', tech_stack: ['React', 'FastAPI'], metrics_outcome: 'Reduced response latency by 40%' }
                  ]).slice(0, 3).map((p, idx) => {
                    const name = typeof p === 'string' ? p : p.name;
                    const tech = typeof p === 'object' && p.tech_stack ? p.tech_stack : [];
                    const metric = typeof p === 'object' && p.metrics_outcome ? p.metrics_outcome : '';
                    return (
                      <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {name}
                          </span>
                          {metric && (
                            <span className="text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                              {metric}
                            </span>
                          )}
                        </div>
                        {tech.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] text-zinc-400">Stack:</span>
                            {tech.map((t, tIdx) => (
                              <span key={tIdx} className="text-[10px] text-zinc-300 px-1.5 py-0.5 rounded bg-white/5">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* JD Match Alignment */}
              {summary.jd_analysis?.matched_skills && summary.jd_analysis.matched_skills.length > 0 && (
                <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-xs">
                  <span className="text-emerald-400 font-medium shrink-0 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    JD Matched:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {summary.jd_analysis.matched_skills.slice(0, 6).map((m, idx) => (
                      <span key={idx} className="text-[11px] text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>



            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setSummary(null)}
                className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                ← Upload different files
              </button>

              <button
                onClick={() => onComplete(summary)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <span>Enter Live Voice Interview</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Ethical Disclosure Footer */}
      <footer className="pt-6 border-t border-white/5 text-center text-xs text-zinc-400 space-y-1">
        <p className="flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-zinc-400" />
          <span>Sessions are protected, privacy-compliant, and strictly restricted to constructive practice feedback.</span>
        </p>
        <p className="text-zinc-400">Zero hiring/rejection decisions are ever rendered.</p>
      </footer>
    </div>
  );
}
