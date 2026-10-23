/**
 * App — Root component orchestrating the three screens:
 *   1. UploadScreen  — resume + JD upload
 *   2. InterviewScreen — live interview with voice/text
 *   3. ReportScreen  — feedback report
 */

import { useState, useCallback } from 'react';
import UploadScreen from './components/UploadScreen';
import InterviewScreen from './components/InterviewScreen';
import ReportScreen from './components/ReportScreen';

const SCREENS = {
  UPLOAD: 'upload',
  INTERVIEW: 'interview',
  REPORT: 'report',
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const App = () => {
  const [screen, setScreen] = useState(SCREENS.UPLOAD);
  const [report, setReport] = useState(null);

  const handleUploadComplete = useCallback(async (summary, questionDifficulty, interviewType) => {
    const response = await fetch(`${API_BASE}/api/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_summary: summary,
        question_difficulty: questionDifficulty,
        interview_type: interviewType,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Could not start interview (${response.status})`);
    }
    setScreen(SCREENS.INTERVIEW);
  }, []);

  const handleInterviewEnd = useCallback((reportData) => {
    setReport(reportData);
    setScreen(SCREENS.REPORT);
  }, []);

  const handleRestart = useCallback(() => {
    setReport(null);
    setScreen(SCREENS.UPLOAD);
  }, []);

  return (
    <>
      {screen === SCREENS.UPLOAD && (
        <UploadScreen onComplete={handleUploadComplete} />
      )}
      {screen === SCREENS.INTERVIEW && (
        <InterviewScreen onEnd={handleInterviewEnd} />
      )}
      {screen === SCREENS.REPORT && (
        <ReportScreen report={report} onRestart={handleRestart} />
      )}
    </>
  );
};

export default App;