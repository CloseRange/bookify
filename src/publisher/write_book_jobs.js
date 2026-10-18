const { writeBook } = require("./write_book");
const {
  resetBookProgress,
  getWriteBookProgress,
  completeBookProgress,
  failBookProgress,
  isWriteBookRunning,
  setWriteBookRunning,
} = require("./write_book_progress");

function startWriteBookJob(prompt) {
  if (isWriteBookRunning()) {
    throw new Error("A book is already being written");
  }

  resetBookProgress(prompt);
  setWriteBookRunning(true);

  writeBook(prompt)
    .then((result) => {
      completeBookProgress(result);
    })
    .catch((error) => {
      failBookProgress(error);
    })
    .finally(() => {
      setWriteBookRunning(false);
    });

  return { started: true };
}

module.exports = {
  startWriteBookJob,
  getWriteBookProgress,
};
