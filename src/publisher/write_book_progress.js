const TOTAL_BOOK_STEPS = 6;

let writeBookRunning = false;
let writeBookProgress = {
  status: "idle",
  step: 0,
  label: "Idle",
  error: null,
  result: null,
  prompt: null,
  startedAt: null,
  updatedAt: new Date().toISOString(),
};

function setBookProgress(step, label) {
  writeBookProgress = {
    ...writeBookProgress,
    status: "in_progress",
    step,
    label,
    error: null,
    updatedAt: new Date().toISOString(),
  };
}

function completeBookProgress(result) {
  writeBookProgress = {
    ...writeBookProgress,
    status: "completed",
    step: TOTAL_BOOK_STEPS,
    label: "Book writing completed",
    result,
    error: null,
    updatedAt: new Date().toISOString(),
  };
}

function failBookProgress(error) {
  writeBookProgress = {
    ...writeBookProgress,
    status: "failed",
    label: "Book writing failed",
    error: error instanceof Error ? error.message : String(error),
    updatedAt: new Date().toISOString(),
  };
}

function resetBookProgress(prompt) {
  const now = new Date().toISOString();
  writeBookProgress = {
    status: "queued",
    step: 0,
    label: "Queued",
    error: null,
    result: null,
    prompt,
    startedAt: now,
    updatedAt: now,
  };
}

function getWriteBookProgress() {
  return { ...writeBookProgress };
}

function isWriteBookRunning() {
  return writeBookRunning;
}

function setWriteBookRunning(isRunning) {
  writeBookRunning = Boolean(isRunning);
}

module.exports = {
  TOTAL_BOOK_STEPS,
  setBookProgress,
  completeBookProgress,
  failBookProgress,
  resetBookProgress,
  getWriteBookProgress,
  isWriteBookRunning,
  setWriteBookRunning,
};
