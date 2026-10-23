/**
 * InterviewScreen — Continuous Hands-Free Conversational Voice UI.
 *
 * Key Capabilities:
 * - Hands-Free Voice Agent: Listens automatically, detects natural speech pauses (1.5s VAD tolerance).
 * - Instant Barge-In: AI voice cuts off the instant candidate speaks.
 * - Reactive Soundwaves: Live frequency canvas reacting to speech.
 * - Live Coaching Telemetry HUD: Real-time STAR detection, WPM pacing gauge, and filler tracker.
 * - Grounding Context: Highlights resume projects and JD requirements linked to current question.
 */

import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Clock,
  Sparkles,
  Zap,
  Target,
  Brain,
  CheckCircle2,
  AlertCircle,
  Activity,
  Send,
  Square,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  MessageSquare,
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
    startContinuousListening,
    replayQuestion,
  } = useVoice();

  const [textInput, setTextInput] = useState('');
  const [showTextFallback, setShowTextFallback] = useState(false);
  const transcriptEndRef = useRef(null);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Auto-scroll transcript container
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  // Transition to report if finished
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
    if (window.confirm('Finish the interview round and view your detailed placement report?')) {
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
    intro: '1. Introduction',
    resume_questions: '2. Resume Grounding',
    behavioural: '3. Behavioral (STAR)',
    role_questions: '4. Role Alignment',
    candidate_questions: '5. Candidate Q&A',
    closing: '6. Wrap-Up',
  };

  const stagesList = ['intro', 'resume_questions', 'behavioural', 'role_questions', 'candidate_questions', 'closing'];
  const currentStage = interviewState?.stage || 'intro';
  const currentStageIdx = stagesList.indexOf(currentStage);

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* ── Top Bar: Stage Stepper & Session Stats ────────────────── */}
      <header className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        {/* Stage Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {stagesList.map((stg, idx) => {
            const isActive = stg === currentStage;
            const isDone = idx < currentStageIdx;
            return (
              <div
                key={stg}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/20'
                    : isDone
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-zinc-400 bg-white/[0.02] border border-white/5'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx === currentStageIdx ? <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" /> : null}
                <span>{stageDisplayNames[stg]}</span>
              </div>
            );
          })}
        </div>

        {/* Right Info: Timer & Budget */}
        <div className="flex items-center gap-4 text-xs shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
            {interviewState?.difficulty || 'Beginner'} difficulty
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{formatTime(interviewState?.time_remaining)}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span>Budget: <strong className="text-white">{interviewState?.questions_remaining ?? 12}</strong> left</span>
          </div>

          {latency > 0 && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-zinc-400">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{latency}ms turn</span>
            </div>
          )}

          <button
            onClick={handleEndInterview}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium cursor-pointer transition-colors"
          >
            Wrap Up
          </button>
        </div>
      </header>

      {/* ── Main Voice Centerpiece ──────────────────────────────── */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left Column: Live Audio Coach Stage & Active Question */}
        <div className="lg:col-span-7 flex flex-col space-y-5">
          {/* Active AI Question Card */}
          <div className="relative rounded-3xl p-6 md:p-8 bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/15 backdrop-blur-2xl shadow-2xl space-y-6">
            {/* Status Header */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isSpeaking ? 'bg-indigo-400' : isListening ? 'bg-emerald-400' : 'bg-zinc-400'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isSpeaking ? 'bg-indigo-500' : isListening ? 'bg-emerald-500' : 'bg-zinc-500'
                  }`} />
                </span>

                <span className="font-medium text-white tracking-wide uppercase text-[11px]">
                  {isSpeaking
                    ? 'AI Coach Speaking (Speak to Interrupt)'
                    : isProcessing
                    ? 'Evaluating Response...'
                    : isListening
                    ? 'Listening Hands-Free (Speak naturally)'
                    : 'Standing By'}
                </span>
              </div>

              {/* Hands-Free Toggle Badge */}
              <button
                onClick={() => setHandsFree(!handsFree)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                  handsFree
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-white/10'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>{handsFree ? 'Auto-Listen: ON' : 'Manual Push: ON'}</span>
              </button>
            </div>

            {/* Current Question Text */}
            <div className="min-h-[90px] flex items-center">
              <p className="text-xl md:text-2xl font-semibold text-white tracking-tight leading-relaxed">
                "{interviewState?.current_question || agentMessage || 'Connecting to interview agent...'}"
              </p>
            </div>

            {/* Real-time Reactive Soundwave Canvas */}
            <div className="pt-2 border-t border-white/5 flex flex-col items-center">
              <VoiceVisualizer
                audioLevel={audioLevel}
                isSpeaking={isSpeaking}
                isListening={isListening}
                isProcessing={isProcessing}
              />

              {/* Live Status Subtitle */}
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                {isSpeaking ? (
                  <button
                    onClick={interruptAgent}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 cursor-pointer"
                  >
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    <span>Click or speak to interrupt</span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={replayQuestion}
                      title="Replay coach question voice"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer text-[11px]"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Replay Question Voice</span>
                    </button>
                    {isListening && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Hands-free active • 1.5s gap commit</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Silence Gap Countdown Indicator (Thinking Pause) */}
            {gapTimeRemaining > 0 && (
              <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs animate-pulse">
                <Clock className="w-4 h-4" />
                <span>Pause detected: finalizing answer in <strong>{(gapTimeRemaining / 1000).toFixed(1)}s</strong> (keep speaking to continue)</span>
              </div>
            )}
          </div>

          {/* Real-Time Candidate Interim Transcription Bubble */}
          {interimText && (
            <div className="rounded-2xl p-5 bg-emerald-500/[0.04] border border-emerald-500/25 backdrop-blur-xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs text-emerald-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Mic className="w-3.5 h-3.5" />
                  Live Speech Input
                </span>
                <span className="text-zinc-400 text-[11px]">Auto-submits after 1.5s pause</span>
              </div>
              <p className="text-sm md:text-base text-zinc-200 italic leading-relaxed">
                "{interimText}"
              </p>
            </div>
          )}

          {/* Manual Input Toggle / Fallback */}
          <div className="flex items-center justify-between text-xs px-2">
            <button
              onClick={() => setShowTextFallback(!showTextFallback)}
              className="text-zinc-400 hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{showTextFallback ? 'Hide text input' : 'Type answer instead'}</span>
            </button>

            <span className="text-zinc-400">Voice agent auto-manages turn taking</span>
          </div>

          {showTextFallback && (
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your interview response..."
                disabled={isProcessing}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-400 text-sm focus:outline-none focus:border-indigo-500/50"
              />
              <button
                type="submit"
                disabled={!textInput.trim() || isProcessing}
                className="px-5 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 cursor-pointer"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Live Telemetry HUD & Live Transcript */}
        <div className="lg:col-span-5 flex flex-col space-y-5">
          {/* 🌟 EXTRA FEATURE: Real-time Live Coaching Telemetry HUD */}
          <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/10 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-xs font-semibold text-white tracking-wide uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Live Answer Telemetry HUD
              </h3>
              <span className="text-[10px] text-zinc-400 px-2 py-0.5 rounded-full bg-white/5">Active Round</span>
            </div>

            {/* STAR Coverage Gauges */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">STAR Framework Coverage</span>
                <span className="text-[11px] text-indigo-400">Auto-detected live</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'situation', label: 'S', title: 'Situation' },
                  { key: 'task', label: 'T', title: 'Task' },
                  { key: 'action', label: 'A', title: 'Action' },
                  { key: 'result', label: 'R', title: 'Result' },
                ].map(({ key, label, title }) => {
                  const active = telemetry.starCoverage[key];
                  return (
                    <div
                      key={key}
                      title={title}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10'
                          : 'bg-white/[0.02] border-white/5 text-zinc-400'
                      }`}
                    >
                      <span className="text-sm font-bold">{label}</span>
                      <span className="text-[10px] mt-0.5">{title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Speech Signals: Pacing (WPM) & Filler Counter */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[11px] text-zinc-400 block">Pacing (WPM)</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-lg font-bold text-white">{telemetry.wpm || '--'}</span>
                  <span className={`text-[10px] font-medium ${
                    telemetry.wpm >= 120 && telemetry.wpm <= 165
                      ? 'text-emerald-400'
                      : telemetry.wpm > 165
                      ? 'text-amber-400'
                      : 'text-zinc-400'
                  }`}>
                    {telemetry.wpm >= 120 && telemetry.wpm <= 165 ? 'Optimal' : telemetry.wpm > 165 ? 'Fast' : 'Steady'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[11px] text-zinc-400 block">Fillers Detected</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className={`text-lg font-bold ${telemetry.fillerCount > 3 ? 'text-rose-400' : 'text-white'}`}>
                    {telemetry.fillerCount}
                  </span>
                  <span className="text-[10px] text-zinc-400">words</span>
                </div>
              </div>
            </div>
          </div>

          {/* Full Live Conversation Transcript */}
          <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/10 backdrop-blur-xl flex flex-col h-[340px]">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 shrink-0">
              <h3 className="text-xs font-semibold text-white tracking-wide uppercase flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                Live Dialogue Record
              </h3>
              <span className="text-[11px] text-zinc-400">{transcript.length} turns</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1 text-xs">
              {transcript.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-400 text-center italic">
                  Conversation transcript will appear here turn by turn...
                </div>
              ) : (
                transcript.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl ${
                      item.speaker === 'agent'
                        ? 'bg-indigo-500/10 border border-indigo-500/20 text-zinc-200'
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-zinc-200 ml-4'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 text-[11px] font-semibold">
                      <span className={item.speaker === 'agent' ? 'text-indigo-400' : 'text-emerald-400'}>
                        {item.speaker === 'agent' ? 'AI Placement Coach' : 'You (Candidate)'}
                      </span>
                    </div>
                    <p className="leading-relaxed">{item.text}</p>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
