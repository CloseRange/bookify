const {
  startWriteBookJob,
  getWriteBookProgress,
} = require("../publisher/write_book_jobs");

const { TOTAL_BOOK_STEPS } = require("../publisher/write_book_progress");

async function main() {
  const prompt = "Write a 1 paragraph short story about a cat who learns to play the piano.";
  startWriteBookJob(prompt);

  console.log("Started single global write-book job");

  const timer = setInterval(() => {
    const job = getWriteBookProgress();
    const percent = Math.round((job.step / TOTAL_BOOK_STEPS) * 100);

    console.log(
      `[${new Date().toISOString()}] ${job.status} ${job.step}/${TOTAL_BOOK_STEPS} (${percent}%) - ${job.label}`
    );


    if (job.status === "completed") {
      console.log("Result:", job.result);
      clearInterval(timer);
    }

    if (job.status === "failed") {
      console.error("Error:", job.error);
      clearInterval(timer);
      process.exitCode = 1;
    }
  }, 1000);
}

main().catch((error) => {
  console.error("Test script failed:", error);
  process.exit(1);
});
