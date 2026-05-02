import { useEffect, useRef, useState } from "react";

export function useGenerationQueueState(initialQueue = [], {
  onRecoveredJobs = () => {},
} = {}) {
  const [generationQueue, setGenerationQueue] = useState(initialQueue || []);
  const [queueRunning, setQueueRunning] = useState(false);
  const queueRunningRef = useRef(false);
  const queueStopRef = useRef(false);
  const generationQueueRef = useRef(generationQueue);
  const onRecoveredJobsRef = useRef(onRecoveredJobs);

  useEffect(() => {
    onRecoveredJobsRef.current = onRecoveredJobs;
  }, [onRecoveredJobs]);

  useEffect(() => {
    generationQueueRef.current = generationQueue;
  }, [generationQueue]);

  useEffect(() => {
    const recoveredCount = generationQueue.filter((job) => job.wasRecovered && !job.recoveryNotified).length;
    if (!recoveredCount) return;
    onRecoveredJobsRef.current(recoveredCount);
    setGenerationQueue((current) => current.map((job) => (
      job.wasRecovered ? { ...job, recoveryNotified: true } : job
    )));
  }, [generationQueue]);

  return {
    generationQueue,
    setGenerationQueue,
    queueRunning,
    setQueueRunning,
    queueRunningRef,
    queueStopRef,
    generationQueueRef,
  };
}
