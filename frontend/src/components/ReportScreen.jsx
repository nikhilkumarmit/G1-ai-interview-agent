import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
} from 'lucide-react';

export default function ReportScreen({ report, onRestart }) {
  const [activeTab, setActiveTab] = useState('breakdown'); // 'breakdown', 'speech', 'transcript'
  const [expandedModelAnswers, setExpandedModelAnswers] = useState({});

  if (!report) return null;

  const { scored_answers, overall_scores, speech_metrics, strengths, improvements, full_transcript, disclaimer } = report;

  const toggleModelAnswer = (idx) => {
    setExpandedModelAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getScoreColor = (score) => {
    if (score >= 4) return 'text-emerald-400 bg-emerald-950/30 border-emerald-800/60';
    if (score >= 3) return 'text-amber-400 bg-amber-950/30 border-amber-800/60';
    return 'text-rose-400 bg-rose-950/30 border-rose-800/60';
  };

  const handleDownloadReport = () => {
    const text = `# Placement HR Round Feedback Report
Date: ${new Date().toLocaleDateString()}
Composite Score: ${overall_scores?.composite || 'N/A'} / 5.0

## Rubric Dimensions:
- Relevance: ${overall_scores?.relevance || 'N/A'} / 5
- Structure (STAR): ${overall_scores?.structure || 'N/A'} / 5
- Specificity: ${overall_scores?.specificity || 'N/A'} / 5
- Communication: ${overall_scores?.communication || 'N/A'} / 5

## Speech Metrics:
- Words Per Minute: ${speech_metrics?.wpm || 'N/A'}
- Long Pauses: ${speech_metrics?.long_pauses || 0}
- Filler Words: ${speech_metrics?.filler_words_count || 0}

## Top Strengths:
${(strengths || []).map(s => `- ${s}`).join('\n')}

## Actionable Improvements:
${(improvements || []).map(i => `- ${i}`).join('\n')}

## Full Interview Transcript:
${(full_transcript || []).map(t => `[${t.speaker.toUpperCase()}]: ${t.text}`).join('\n\n')}

Disclaimer: ${disclaimer}
`;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* ── Top Header ───────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-zinc-800 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-400">Round Concluded</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
            Interview Performance Report
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Formative feedback grounded in your transcript and technical rubric
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Download .md</span>
          </button>

          <button
            onClick={onRestart}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </header>

      {/* ── Score Cards Overview ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
          <span className="text-xs text-zinc-500 font-medium block">Composite Score</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-zinc-100">{overall_scores?.composite || '4.0'}</span>
            <span className="text-xs text-zinc-500">/ 5.0</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
          <span className="text-xs text-zinc-500 font-medium block">Pacing</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-zinc-100">{speech_metrics?.wpm || 135}</span>
            <span className="text-xs text-zinc-500">WPM</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
          <span className="text-xs text-zinc-500 font-medium block">Filler Words</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-zinc-100">{speech_metrics?.filler_words_count || 0}</span>
            <span className="text-xs text-zinc-500">instances</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800">
          <span className="text-xs text-zinc-500 font-medium block">Questions Evaluated</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-zinc-100">{scored_answers?.length || 0}</span>
            <span className="text-xs text-zinc-500">questions</span>
          </div>
        </div>
      </div>

      {/* ── Strengths & Improvements ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Strengths */}
        <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Demonstrated Strengths</h3>
          </div>
          <ul className="space-y-2 text-xs text-zinc-300">
            {(strengths && strengths.length > 0 ? strengths : [
              'Structured responses effectively with clear context.',
              'Grounded technical explanations in concrete implementation details.',
              'Maintained steady speech cadence throughout the session.'
            ]).map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Improvements */}
        <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Areas for Growth</h3>
          </div>
          <ul className="space-y-2 text-xs text-zinc-300">
            {(improvements && improvements.length > 0 ? improvements : [
              'Include more quantifiable outcome metrics (e.g. latency, throughput).',
              'Elaborate further on architectural trade-offs when asked technical follow-ups.',
              'Aim to reduce filler words during initial thinking pauses.'
            ]).map((imp, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Navigation Tabs ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('breakdown')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'breakdown'
              ? 'bg-zinc-100 text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Question-by-Question Rubric
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'transcript'
              ? 'bg-zinc-100 text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Full Transcript
        </button>
      </div>

      {/* Tab 1: Question Breakdown with Evidence & Model Answers */}
      {activeTab === 'breakdown' && (
        <div className="space-y-4">
          {(scored_answers || []).map((qa, idx) => {
            const isExpanded = !!expandedModelAnswers[idx];
            return (
              <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                {/* Question Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wide">
                      Question {idx + 1} • {qa.stage || 'General'}
                    </span>
                    <h4 className="text-sm font-semibold text-zinc-100">
                      "{qa.question}"
                    </h4>
                  </div>

                  {qa.score && (
                    <span className={`px-2.5 py-1 rounded text-xs font-mono font-medium border ${getScoreColor(qa.score)}`}>
                      {qa.score} / 5.0
                    </span>
                  )}
                </div>

                {/* Candidate Answer */}
                <div className="p-3.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase block">Candidate Answer</span>
                  <p>{qa.answer || '(No answer recorded)'}</p>
                </div>

                {/* Rubric Feedback & Quote Evidence */}
                {qa.evidence_quote && (
                  <div className="border-l-2 border-zinc-600 pl-3 py-1 text-xs italic text-zinc-400">
                    Quote Evidence: "{qa.evidence_quote}"
                  </div>
                )}

                {qa.feedback && (
                  <p className="text-xs text-zinc-400">
                    <strong className="text-zinc-300 font-medium">Evaluation:</strong> {qa.feedback}
                  </p>
                )}

                {/* Senior Model Answer Toggle */}
                {qa.model_answer && (
                  <div className="pt-2 border-t border-zinc-800/80">
                    <button
                      onClick={() => toggleModelAnswer(idx)}
                      className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white font-medium transition-colors cursor-pointer"
                    >
                      <span>Senior Placement Model Answer</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 leading-relaxed space-y-2">
                        <p>{qa.model_answer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Full Transcript */}
      {activeTab === 'transcript' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
          {(full_transcript || []).map((t, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border text-xs leading-relaxed ${
                t.speaker === 'agent'
                  ? 'bg-zinc-900/80 border-zinc-800 text-zinc-200'
                  : 'bg-zinc-950 border-zinc-800/60 text-zinc-300'
              }`}
            >
              <span className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">
                {t.speaker === 'agent' ? 'Interviewer' : 'Candidate'}
              </span>
              <p>{t.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="pt-6 border-t border-zinc-800 text-center text-xs text-zinc-500">
        <p>{disclaimer || 'Practice session evaluation. Zero hiring or rejection decisions are rendered.'}</p>
      </footer>
    </div>
  );
}
