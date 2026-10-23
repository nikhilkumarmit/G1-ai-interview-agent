/**
 * useVoice — Continuous Real-Time Conversational Voice Hook.
 *
 * Features:
 * - Hands-free conversational loop: automatically detects speech gaps & pauses.
 * - Thinking pause tolerance: tuned to 1500ms silence before auto-committing answer.
 * - Barge-in / Interruption handling: AI stops talking the instant candidate speaks.
 * - Web Audio API Analyser: real-time audio frequency & volume for live soundwaves.
 * - Live Speech Telemetry: real-time WPM, filler word count, and STAR framework heuristic.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const WS_URL = `ws://${window.location.hostname}:8000/ws/text`;

// Known filler words for real-time telemetry
const FILLER_WORDS = ['um', 'uh', 'like', 'basically', 'actually', 'you know', 'sort of', 'kind of', 'i mean', 'right?'];

export function useVoice() {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [handsFree, setHandsFree] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 for visualizer
  const [transcript, setTranscript] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [agentMessage, setAgentMessage] = useState('');
  const [interviewState, setInterviewState] = useState(null);
  const [latency, setLatency] = useState(0);
  const [gapTimeRemaining, setGapTimeRemaining] = useState(0); // in ms
  const [telemetry, setTelemetry] = useState({
    wpm: 0,
    wordCount: 0,
    fillerCount: 0,
    starCoverage: { situation: false, task: false, action: false, result: false },
  });

  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animFrameRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const gapIntervalRef = useRef(null);
  const answerStartTimeRef = useRef(0);
  const speechStartTimeRef = useRef(0);
  const accumulatedCandidateTextRef = useRef('');
  const isAgentSpeakingRef = useRef(false);
  const handsFreeRef = useRef(true);
  const startContinuousListeningRef = useRef(null);

  handsFreeRef.current = handsFree;

  // ── Analyze candidate text for live telemetry (STAR, WPM, fillers) ────
  const analyzeCandidateText = useCallback((text) => {
    if (!text.trim()) return;
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Fillers count
    let fillerCount = 0;
    const lower = text.toLowerCase();
    FILLER_WORDS.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) fillerCount += matches.length;
    });

    // Estimated WPM
    const elapsedMinutes = speechStartTimeRef.current > 0
      ? (Date.now() - speechStartTimeRef.current) / 60000
      : 0.1;
    const wpm = elapsedMinutes > 0 ? Math.round(wordCount / elapsedMinutes) : 130;

    // Heuristic detection of STAR framework
    const star = {
      situation: /\b(when|at|while working at|company|project|situation|background|context|problem was)\b/i.test(lower),
      task: /\b(goal|objective|needed to|task|assigned|responsible for|target|requirement)\b/i.test(lower),
      action: /\b(i developed|i built|i designed|i implemented|i led|i created|we utilized|i wrote|we migrated)\b/i.test(lower),
      result: /\b(result|outcome|improved|reduced|increased|achieved|by \d+%|saved|delivered|metric)\b/i.test(lower),
    };

    setTelemetry({
      wpm: Math.min(Math.max(wpm, 40), 260),
      wordCount,
      fillerCount,
      starCoverage: star,
    });
  }, []);

  // Preload synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // ── Browser TTS with instant Barge-in support ──────────────────────
  const speakText = useCallback((text) => {
    if (!('speechSynthesis' in window) || !text?.trim()) return;

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {
      console.warn('SpeechSynthesis cancel/resume error:', e);
    }

    isAgentSpeakingRef.current = true;
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel')
    );
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      isAgentSpeakingRef.current = false;
      setIsSpeaking(false);
      // When AI finishes speaking, immediately start listening for candidate answer
      if (handsFreeRef.current) {
        startContinuousListeningRef.current?.();
      }
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      isAgentSpeakingRef.current = false;
      setIsSpeaking(false);
      if (handsFreeRef.current) {
        startContinuousListeningRef.current?.();
      }
    };

    // Small delay ensures Chromium cleans up any previously canceled utterance
    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('SpeechSynthesis speak failed:', err);
      }
    }, 40);
  }, []);

  // ── Cancel Agent Speech (Barge-in / Interruption) ─────────────────
  const interruptAgent = useCallback(() => {
    if (isAgentSpeakingRef.current || window.speechSynthesis.speaking) {
      console.log('⚡ Barge-in: Candidate interrupted the AI coach');
      window.speechSynthesis.cancel();
      isAgentSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, []);

  // ── Send candidate answer to backend ─────────────────────────────
  const sendAnswer = useCallback((text) => {
    const clean = text.trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Reset interim and timers
    accumulatedCandidateTextRef.current = '';
    setInterimText('');
    setGapTimeRemaining(0);
    clearInterval(gapIntervalRef.current);
    clearTimeout(silenceTimerRef.current);

    answerStartTimeRef.current = Date.now();
    setIsProcessing(true);
    setIsListening(false);

    setTranscript(prev => [...prev, { speaker: 'candidate', text: clean }]);
    wsRef.current.send(JSON.stringify({ type: 'candidate_answer', text: clean }));
  }, []);

  // ── Start Continuous Listening & Gap (VAD) Detection ────────────
  const startContinuousListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (e) { /* already started */ }
      setIsListening(true);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech Recognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      // 1. If AI is talking when candidate starts speaking: Barge-In Interruption!
      interruptAgent();

      let currentInterim = '';
      let newlyFinalized = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          newlyFinalized += item[0].transcript + ' ';
        } else {
          currentInterim += item[0].transcript;
        }
      }

      if (speechStartTimeRef.current === 0) {
        speechStartTimeRef.current = Date.now();
      }

      if (newlyFinalized) {
        accumulatedCandidateTextRef.current += newlyFinalized;
      }

      const fullDraft = (accumulatedCandidateTextRef.current + ' ' + currentInterim).trim();
      setInterimText(fullDraft);
      analyzeCandidateText(fullDraft);

      // 2. GAP / SILENCE DETECTION (Thinking pause tolerance: 1500ms)
      // Every time speech is detected, clear the gap timer
      clearTimeout(silenceTimerRef.current);
      clearInterval(gapIntervalRef.current);
      setGapTimeRemaining(0);

      // If we have content, start the 1.5s countdown after candidate pauses speaking
      if (fullDraft.length > 3 && handsFreeRef.current) {
        const SILENCE_MS = 1500;
        const startTime = Date.now();

        gapIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, SILENCE_MS - elapsed);
          setGapTimeRemaining(remaining);
          if (remaining <= 0) {
            clearInterval(gapIntervalRef.current);
          }
        }, 100);

        silenceTimerRef.current = setTimeout(() => {
          const finalAnswer = accumulatedCandidateTextRef.current.trim() || currentInterim.trim();
          if (finalAnswer.length > 2) {
            console.log('⏱️ 1.5s thinking pause / silence gap detected — auto-committing answer');
            speechStartTimeRef.current = 0;
            sendAnswer(finalAnswer);
          }
        }, SILENCE_MS);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      console.warn('Speech recognition warning:', event.error);
    };

    recognition.onend = () => {
      // If hands-free is enabled and we are not currently processing or agent speaking, restart recognition
      if (handsFreeRef.current && !isAgentSpeakingRef.current) {
        try { recognition.start(); } catch (e) { /* ignore restart error */ }
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }
  }, [interruptAgent, sendAnswer, analyzeCandidateText]);

  startContinuousListeningRef.current = startContinuousListening;

  // ── Web Audio Analyser (Live Soundwaves) ─────────────────────────
  const initAudioVisualizer = useCallback(async () => {
    try {
      if (micStreamRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Normalize 0-100
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.warn('Microphone audio visualizer access:', e.message);
    }
  }, []);

  // ── WebSocket Connect ────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('🔌 Voice WebSocket connected');
      initAudioVisualizer();
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'agent_message') {
        setAgentMessage(data.text);
        setTranscript(prev => [...prev, { speaker: 'agent', text: data.text }]);
        setInterviewState(data.state);
        setIsProcessing(false);

        // Turn latency
        if (answerStartTimeRef.current > 0) {
          const lat = Date.now() - answerStartTimeRef.current;
          setLatency(lat);
          answerStartTimeRef.current = 0;
        }

        // Deliver question via TTS
        speakText(data.text);
      }

      if (data.type === 'report') {
        window.speechSynthesis?.cancel();
        setInterviewState({ ...data.state, report: data.report });
        setIsProcessing(false);
        setIsListening(false);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsListening(false);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    wsRef.current = ws;
  }, [speakText, initAudioVisualizer]);

  // ── Cleanup ──────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    window.speechSynthesis?.cancel();
    clearTimeout(silenceTimerRef.current);
    clearInterval(gapIntervalRef.current);
    cancelAnimationFrame(animFrameRef.current);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }

    wsRef.current?.close();
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  }, []);

  const endInterview = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    window.speechSynthesis?.cancel();
    setIsProcessing(true);
    wsRef.current.send(JSON.stringify({ type: 'end_interview' }));
  }, []);

  const replayQuestion = useCallback(() => {
    if (agentMessage) {
      speakText(agentMessage);
    }
  }, [agentMessage, speakText]);

  return {
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
  };
}
