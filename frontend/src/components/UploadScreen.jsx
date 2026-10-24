import { useState, useRef } from 'react';
import {
  FileText,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Loader2,
  Mic,
  Lock,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-10 max-w-5xl mx-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-100">
              Mock Interview Coach
            </h1>
            <p className="text-xs text-zinc-400">Technical & Behavioral Placement Practice</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Feedback Only • Non-Evaluative</span>
        </div>
      </header>

      {/* Main Body */}
      <main className="py-10 flex-1 flex flex-col justify-center">
        {!summary ? (
          <div className="flex flex-col gap-8 w-full max-w-3xl mx-auto">
            <div className="text-center max-w-2xl mx-auto flex flex-col gap-2.5">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-100">
                Placement Interview Practice
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Upload your resume and a target job description. The voice coach grounds each technical question and STAR prompt in your actual experience.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/50 text-rose-300 text-xs max-w-xl mx-auto">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <p>{error}</p>
              </div>
            )}

            {/* Upload Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
              {/* Resume Card */}
              <div
                className={`rounded-xl p-6 transition-colors cursor-pointer border flex flex-col items-center justify-center min-h-[210px] text-center ${
                  dragOver.resume
                    ? 'border-zinc-500 bg-zinc-900'
                    : resumeFile
                    ? 'border-emerald-600/50 bg-zinc-900/80'
                    : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700'
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
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
                    resumeFile
                      ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400'
                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
                  }`}>
                    {resumeFile ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-100 text-sm">Resume</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-[220px] truncate">
                      {resumeFile ? (
                        <span className="text-emerald-400 font-medium">{resumeFile.name}</span>
                      ) : (
                        'Drop PDF or TXT resume'
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-zinc-400 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/60">
                    {resumeFile ? `${(resumeFile.size / 1024).toFixed(1)} KB` : 'Browse File'}
                  </span>
                </div>
              </div>

              {/* JD Card */}
              <div
                className={`rounded-xl p-6 transition-colors cursor-pointer border flex flex-col items-center justify-center min-h-[210px] text-center ${
                  dragOver.jd
                    ? 'border-zinc-500 bg-zinc-900'
                    : jdFile
                    ? 'border-emerald-600/50 bg-zinc-900/80'
                    : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700'
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
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
                    jdFile
                      ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400'
                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
                  }`}>
                    {jdFile ? <CheckCircle2 className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-100 text-sm">Job Description</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-[220px] truncate">
                      {jdFile ? (
                        <span className="text-emerald-400 font-medium">{jdFile.name}</span>
                      ) : (
                        'Drop PDF or TXT requirements'
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-zinc-400 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/60">
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
                className="px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors bg-white text-zinc-950 hover:bg-zinc-200 disabled:bg-zinc-900 disabled:text-zinc-500 disabled:border disabled:border-zinc-800 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                    <span>Processing documents...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Interview Session</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Candidate Profile Summary Screen */
          <div className="max-w-2xl mx-auto space-y-5 w-full">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-semibold text-zinc-100 tracking-tight">Verified Candidate Profile</h2>
              <p className="text-xs text-zinc-400">Questions in this round will be grounded in these extracted details</p>
            </div>

            <div className="rounded-xl p-6 bg-zinc-900/60 border border-zinc-800 space-y-5">
              {/* Name & Target Role Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-zinc-800">
                <div>
                  <label className="text-xs text-zinc-400 block font-medium">Candidate Name</label>
                  <input
                    type="text"
                    value={summary.candidate_name || ''}
                    onChange={(e) => setSummary(prev => ({ ...prev, candidate_name: e.target.value }))}
                    placeholder="Candidate Name"
                    className="w-full mt-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-100 font-medium text-sm focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block font-medium">Target Role</label>
                  <input
                    type="text"
                    value={summary.target_role || ''}
                    onChange={(e) => setSummary(prev => ({ ...prev, target_role: e.target.value }))}
                    placeholder="e.g. Backend Engineer"
                    className="w-full mt-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-100 font-medium text-sm focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                </div>
              </div>

              {/* Experience Summary */}
              {summary.experience_summary && (
                <div className="p-3.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                  "{summary.experience_summary}"
                </div>
              )}

              {/* Skills */}
              <div>
                <span className="text-xs text-zinc-400 block font-medium mb-2">Technical Skills ({summary.skills_found?.length || 0})</span>
                <div className="flex flex-wrap gap-1.5">
                  {(summary.skills_found && summary.skills_found.length > 0 ? summary.skills_found : ['Python', 'FastAPI', 'React', 'Docker']).slice(0, 16).map((skill, idx) => (
                    <span key={idx} className="text-xs font-medium px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Verified Projects */}
              <div>
                <span className="text-xs text-zinc-400 block font-medium mb-2">
                  Verified Projects ({summary.project_count || summary.projects?.length || 0})
                </span>
                <div className="space-y-2">
                  {(summary.projects && summary.projects.length > 0 ? summary.projects : [
                    { name: 'Engineering Project', tech_stack: ['Python', 'FastAPI'], metrics_outcome: 'Production system' }
                  ]).slice(0, 3).map((proj, idx) => {
                    const title = typeof proj === 'string' ? proj : (proj.name || 'Project');
                    const tech = Array.isArray(proj?.tech_stack) ? proj.tech_stack : [];
                    const metric = proj?.metrics_outcome;

                    return (
                      <div key={idx} className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/80 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-200">{title}</span>
                          {tech.length > 0 && (
                            <div className="flex gap-1">
                              {tech.slice(0, 3).map((t, tidx) => (
                                <span key={tidx} className="text-[11px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {metric && (
                          <p className="text-zinc-400 text-[11px]">Outcome: {metric}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setSummary(null)}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                ← Change documents
              </button>

              <button
                onClick={() => onComplete(summary)}
                className="px-5 py-2.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <span>Begin Voice Interview</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="pt-6 border-t border-zinc-800 text-center text-xs text-zinc-500 space-y-1">
        <p className="flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-zinc-500" />
          <span>Practice session. Transcripts and recordings are used solely for your feedback report.</span>
        </p>
        <p>No hiring or evaluation decisions are made.</p>
      </footer>
    </div>
  );
}
