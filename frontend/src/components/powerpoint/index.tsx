'use client';

import { useState, useCallback } from 'react';
import PowerPointProgressModal from './PowerPointProgressModal';
import PowerPointCompleteModal from './PowerPointCompleteModal';

interface PowerPointGeneratorProps {
  rcaId: string;
  incidentNumber: string;
  children: (triggerGenerate: () => void) => React.ReactNode;
}

/**
 * PowerPoint Generator Component
 * Wraps the progress and completion modals for easy integration
 * 
 * Usage:
 * <PowerPointGenerator rcaId="xxx" incidentNumber="INC-001">
 *   {(triggerGenerate) => (
 *     <button onClick={triggerGenerate}>Generate PowerPoint</button>
 *   )}
 * </PowerPointGenerator>
 */
export default function PowerPointGenerator({
  rcaId,
  incidentNumber,
  children,
}: PowerPointGeneratorProps) {
  const [showProgress, setShowProgress] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [completedJobId, setCompletedJobId] = useState<string>('');
  const [completedFileName, setCompletedFileName] = useState<string>('');

  const triggerGenerate = useCallback(() => {
    setShowProgress(true);
  }, []);

  const handleProgressComplete = useCallback((jobId: string, fileName: string) => {
    setCompletedJobId(jobId);
    setCompletedFileName(fileName);
    
    // Small delay to allow progress modal to show complete state briefly
    setTimeout(() => {
      setShowProgress(false);
      setShowComplete(true);
    }, 1000);
  }, []);

  const handleCompleteClose = useCallback(() => {
    setShowComplete(false);
    setCompletedJobId('');
    setCompletedFileName('');
  }, []);

  return (
    <>
      {children(triggerGenerate)}
      
      <PowerPointProgressModal
        open={showProgress}
        onOpenChange={setShowProgress}
        rcaId={rcaId}
        incidentNumber={incidentNumber}
        onComplete={handleProgressComplete}
      />

      <PowerPointCompleteModal
        open={showComplete}
        onOpenChange={handleCompleteClose}
        jobId={completedJobId}
        fileName={completedFileName}
        incidentNumber={incidentNumber}
        rcaId={rcaId}
      />
    </>
  );
}

// Re-export individual components for direct use
export { PowerPointProgressModal, PowerPointCompleteModal };
