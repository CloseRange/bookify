const form = document.getElementById("form");
const promptEl = document.getElementById("prompt");
const button = document.getElementById("generate");
const progressEl = document.getElementById("progress");
const stepLabel = document.getElementById("step-label");
const percentEl = document.getElementById("percent");
const barFill = document.getElementById("bar-fill");
const stepCount = document.getElementById("step-count");
const errorEl = document.getElementById("error");
const resultEl = document.getElementById("result");
const resultBody = document.getElementById("result-body");

let timer = null;

// Demo mode: when opened directly from disk there is no server, so simulate a job.
const DEMO = location.protocol === "file:";
const DEMO_STEPS = [
  "Planning the story",
  "Outlining chapters",
  "Writing chapters",
  "Illustrating",
  "Editing",
];
let demoStart = 0;

function demoProgress() {
  const step = Math.floor((Date.now() - demoStart) / 2500);
  const total = 6;
  if (step >= total) {
    return {
      status: "completed",
      step: total,
      totalSteps: total,
      label: "Book writing completed",
      result: "Demo mode: this is where the finished book result appears.",
    };
  }
  return {
    status: "in_progress",
    step,
    totalSteps: total,
    label: DEMO_STEPS[Math.min(step, DEMO_STEPS.length - 1)],
  };
}

function setBusy(busy) {
  button.disabled = busy;
  promptEl.disabled = busy;
  button.classList.toggle("loading", busy);
  button.querySelector(".btn-label").textContent = busy
    ? "Writing..."
    : "Generate book";
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function render(job) {
  const total = job.totalSteps || 1;
  const percent = Math.min(100, Math.round((job.step / total) * 100));
  progressEl.classList.remove("hidden");
  stepLabel.textContent = job.label;
  percentEl.textContent = `${percent}%`;
  barFill.style.width = `${percent}%`;
  stepCount.textContent = `Step ${job.step} of ${total}`;
  barFill.classList.toggle("done", job.status === "completed");
  barFill.classList.toggle("failed", job.status === "failed");
}

function stopPolling() {
  clearInterval(timer);
  timer = null;
  setBusy(false);
}

async function poll() {
  try {
    const job = DEMO
      ? demoProgress()
      : await (await fetch("/api/progress")).json();
    render(job);

    if (job.status === "completed") {
      stopPolling();
      resultBody.textContent =
        typeof job.result === "string"
          ? job.result
          : JSON.stringify(job.result, null, 2);
      resultEl.classList.remove("hidden");
    } else if (job.status === "failed") {
      stopPolling();
      showError(job.error || "Book writing failed");
    }
  } catch (error) {
    stopPolling();
    showError(`Lost connection to server: ${error.message}`);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.classList.add("hidden");
  resultEl.classList.add("hidden");
  barFill.style.width = "0%";
  barFill.classList.remove("done", "failed");
  setBusy(true);

  try {
    if (DEMO) {
      demoStart = Date.now();
    } else {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptEl.value }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error || "Failed to start");
      }
    }
    render({ status: "queued", step: 0, label: "Queued", totalSteps: 6 });
    timer = setInterval(poll, 1000);
    poll();
  } catch (error) {
    setBusy(false);
    showError(error.message);
  }
});
