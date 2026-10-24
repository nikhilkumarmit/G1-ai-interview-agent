import { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Radio,
  Clock,
  Target,
  CheckCircle2,
  Send,
  MessageSquare,
  Activity,
} from 'lucide-react';
import { useVoice } from '../hooks/useVoice';
import VoiceVisualizer from './VoiceVisualizer';

export default function InterviewScreen({ onEnd }) {
  const {
    isConnected,
    isListening,
    isSpeaking,
    isProcessing,
    handsFree,
    setHandsFree,
    audioLevel,
    transcript,
    interimText,
    agentMessage,
    interviewState,
    latency,
    gapTimeRemaining,
    telemetry,
    connect,
    disconnect,
    sendAnswer,
    endInterview,
    interruptAgent,
    replayQuestion,
  } = useVoice();

  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const transcriptEndRef = useRef(null);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  // Transition to report when done
  useEffect(() => {
    if (interviewState?.is_finished && interviewState?.report) {
      onEnd(interviewState.report);
    }
  }, [interviewState, onEnd]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim() && !isProcessing) {
      sendAnswer(textInput.trim());
      setTextInput('');
    }
  };

  const handleEndInterview = () => {
    if (window.confirm('End this interview practice round and view your evaluation report?')) {
      endInterview();
    }
  };

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '30:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const stageDisplayNames = {
    intro: '1. Intro',
    resume_questions: '2. Resume',
    behavioural: '3. Behavioral',
    role_questions: '4. Role Alignment',
    candidate_questions: '5. Candidate Q&A',
    closing: '6. Wrap-Up',
  };

  const stagesList = ['intro', 'resume_questions', 'behavioural', 'role_questions', 'candidate_questions', 'closing'];
  const currentStage = interviewState?.stage || 'intro';
  const currentStageIdx = stagesList.indexOf(currentStage);

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto gap-6">
      {/* ── Top Bar: Stage Stepper & Session Stats ────────────────── */}
      <header className="rounded-xl p-3 sm:p-4 bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Stage Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {stagesList.map((stg, idx) => {
            const isActive = stg === currentStage;
            const isDone = idx < currentStageIdx;
            return (
              <div
                key={stg}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-950'
                    : isDone
                    ? 'bg-zinc-800/80 text-emerald-400 border border-emerald-900/40'
                    : 'text-zinc-500 bg-zinc-900/50 border border-zinc-800/50'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : null}
                <span>{stageDisplayNames[stg]}</span>
              </div>
            );
          })}
        </div>

        {/* Right Info: Timer & Controls */}
        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>{formatTime(interviewState?.time_remaining)}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
            <Target className="w-3.5 h-3.5 text-zinc-400" />
            <span>Budget: <strong className="text-zinc-100 font-medium">{interviewState?.questions_remaining ?? 12}</strong> left</span>
          </div>

          <button
            onClick={handleEndInterview}
            className="px-3 py-1 rounded bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 border border-rose-900/50 text-xs font-medium cursor-pointer transition-colors"
          >
            Finish Round
          </button>
        </div>
      </header>

      {/* ── Main Voice Stage ─────────────────────────────────────── */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left Column: Live Audio Coach Stage & Active Question */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Active AI Question Card */}
          <div className="rounded-xl p-6 sm:p-8 bg-zinc-900/40 border border-zinc-800 flex flex-col gap-6">
            {/* Status Header */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  isSpeaking ? 'bg-blue-400 animate-pulse' : isListening ? 'bg-emerald-400' : 'bg-zinc-500'
                }`} />

                <span className="font-medium text-zinc-300 text-xs">
                  {isSpeaking
                    ? 'AI Coach Speaking'
                    : isProcessing
                    ? 'Evaluating Response...'
                    : isListening
                    ? 'Listening (Hands-Free)'
                    : 'Standing By'}
                </span>
              </div>

              {/* Hands-Free Toggle */}
              <button
                onClick={() => setHandsFree(!handsFree)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                  handsFree
                    ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>{handsFree ? 'Auto-Listen: ON' : 'Manual Push'}</span>
              </button>
            </div>

            {/* Current Question Text */}
            <div className="min-h-[80px] flex items-center">
              <p className="text-xl sm:text-2xl font-medium text-zinc-100 tracking-tight leading-relaxed">
                "{interviewState?.current_question || agentMessage || 'Connecting to interview agent...'}"
              </p>
            </div>

            {/* Visualizer & Controls */}
            <div className="pt-2 border-t border-zinc-800/80 flex flex-col items-center">
              <VoiceVisualizer
                audioLevel={audioLevel}
                isSpeaking={isSpeaking}
                isListening={isListening}
                isProcessing={isProcessing}
              />

              {/* Status Bar Buttons */}
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                {isSpeaking ? (
                  <button
                    onClick={interruptAgent}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 text-rose-300 cursor-pointer transition-colors"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Interrupt Coach</span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={replayQuestion}
                      title="Replay coach question voice"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 transition-colors cursor-pointer text-xs"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Replay Question</span>
                    </button>
                    {isListening && (
                      <span className="text-zinc-500 text-xs">
                        1.5s silence gap detection active
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Silence Gap Countdown Indicator */}
            {gapTimeRemaining > 0 && (
              <div className="flex items-center justify-center gap-2 p-2 rounded bg-amber-950/20 border border-amber-900/40 text-amber-300 text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>Pause detected — finalizing in <strong>{(gapTimeRemaining / 1000).toFixed(1)}s</strong></span>
              </div>
            )}
          </div>

          {/* Real-Time Candidate Interim Transcription Bubble */}
          {interimText && (
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <span className="text-[11px] font-medium text-emerald-400 block">Candidate Speech (Live)</span>
              <p className="text-sm text-zinc-200 leading-relaxed font-normal">{interimText}</p>
            </div>
          )}

          {/* Live Coaching Telemetry */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg p-3 bg-zinc-900/40 border border-zinc-800 text-center space-y-0.5">
              <span className="text-[11px] text-zinc-500 font-medium block">Pacing</span>
              <span className="text-base font-semibold text-zinc-100">{telemetry.wpm || 135} <span className="text-xs font-normal text-zinc-500">WPM</span></span>
            </div>

            <div className="rounded-lg p-3 bg-zinc-900/40 border border-zinc-800 text-center space-y-0.5">
              <span className="text-[11px] text-zinc-500 font-medium block">Fillers Detected</span>
              <span className="text-base font-semibold text-zinc-100">{telemetry.fillerCount || 0}</span>
            </div>

            <div className="rounded-lg p-3 bg-zinc-900/40 border border-zinc-800 text-center space-y-0.5">
              <span className="text-[11px] text-zinc-500 font-medium block">STAR Structure</span>
              <div className="flex items-center justify-center gap-1 mt-1">
                {['S', 'T', 'A', 'R'].map((letter, i) => {
                  const key = ['situation', 'task', 'action', 'result'][i];
                  const covered = telemetry.starCoverage?.[key];
                  return (
                    <span
                      key={letter}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        covered
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60'
                          : 'bg-zinc-800/80 text-zinc-500'
                      }`}
                    >
                      {letter}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Conversation Transcript */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-col h-[520px]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                <span>Interview Transcript</span>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">
                {transcript.length} turns
              </span>
            </div>

            {/* Transcript scrollable container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {transcript.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-500 text-center p-6">
                  <p>The conversation transcript will appear here in real time.</p>
                </div>
              ) : (
                transcript.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border leading-relaxed ${
                      msg.speaker === 'agent'
                        ? 'bg-zinc-900/80 border-zinc-800 text-zinc-200'
                        : 'bg-zinc-950 border-zinc-800/60 text-zinc-300'
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-zinc-400 block mb-1">
                      {msg.speaker === 'agent' ? 'Interviewer' : 'Candidate'}
                    </span>
                    <p>{msg.text}</p>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Optional Text Fallback Input */}
            <div className="pt-3 border-t border-zinc-800/80">
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Or type your answer here..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isProcessing}
                  className="px-3 py-1.5 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg text-xs transition-colors disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
