import { findFeedbackLoops, type LoopOptions, type Snapshot } from "@cytocausal/core";

// Cancellation terminates this worker, including synchronous enumeration in progress.
self.onmessage = ({ data }: MessageEvent<{ snapshot: Snapshot; options: LoopOptions }>) => {
  try {
    self.postMessage({ result: findFeedbackLoops(data.snapshot, data.options) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
