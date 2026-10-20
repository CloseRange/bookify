const fs = require("fs");
const path = require("path");

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const AUTHORS_JSON_PATH = path.join(__dirname, "..", "authors", "authors.json");
const ROOT_ENV_PATH = path.join(__dirname, "..", "..", ".env");

function loadEnvFromFileIfNeeded() {
  if (process.env.OPENAI_API_KEY) {
    return;
  }

  if (!fs.existsSync(ROOT_ENV_PATH)) {
    return;
  }

  const envText = fs.readFileSync(ROOT_ENV_PATH, "utf8");
  const lines = envText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getFetch() {
  if (typeof fetch !== "function") {
    throw new Error(
      "Global fetch is not available in this Node runtime. Use Node 18+ or provide a fetch polyfill."
    );
  }

  return fetch;
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data?.output)) {
    return "";
  }

  const chunks = [];
  for (const item of data.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (typeof contentItem?.text === "string") {
        chunks.push(contentItem.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function loadAuthors() {
  const raw = fs.readFileSync(AUTHORS_JSON_PATH, "utf8");
  const authors = JSON.parse(raw);

  if (!Array.isArray(authors) || authors.length === 0) {
    throw new Error("authors.json must contain a non-empty array");
  }

  return authors;
}

function resolveAuthor(authorProfile) {
  if (authorProfile === undefined || authorProfile === null) {
    throw new Error("authorProfile is required");
  }

  const authors = loadAuthors();
  let author;

  if (typeof authorProfile === "number") {
    author = authors[authorProfile];
    if (!author) {
      throw new Error(`No author found at index ${authorProfile}`);
    }
  } else if (typeof authorProfile === "string") {
    author = authors.find((entry) => entry.id === authorProfile.trim());
    if (!author) {
      throw new Error(`No author found with id \"${authorProfile}\"`);
    }
  } else {
    throw new Error("authorProfile must be an author id string or numeric index");
  }

  if (!author.id || typeof author.id !== "string") {
    throw new Error("Resolved author is missing a valid id");
  }

  const authorMarkdownPath = path.join(__dirname, "..", "authors", `${author.id}.md`);
  if (!fs.existsSync(authorMarkdownPath)) {
    throw new Error(`Missing author markdown file: ${author.id}.md`);
  }

  const authorMarkdown = fs.readFileSync(authorMarkdownPath, "utf8");

  return {
    author,
    authorMarkdown,
  };
}

/**
 * Sends author context + a generation request to an AI model and returns text output.
 *
 * @param {string|number} authorProfile Author id (for example "aria") or author index (for example 0).
 * @param {string} generationPrompt Prompt such as "Generate me X, Y, Z".
 * @returns {Promise<string>} Model response text.
 */
async function generateResponse(authorProfile, generationPrompt) {
  loadEnvFromFileIfNeeded();

  if (!generationPrompt || typeof generationPrompt !== "string") {
    throw new Error("generationPrompt must be a non-empty string");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const { author, authorMarkdown } = resolveAuthor(authorProfile);

  const input = [
    {
      role: "system",
      content:
        "You are an expert ghostwriter. Follow the author profile markdown closely when generating output.",
    },
    {
      role: "user",
      content: `Author id: ${author.id}\n\nAuthor profile markdown:\n${authorMarkdown}\n\nRequest:\n${generationPrompt}`,
    },
  ];

  const fetchFn = getFetch();
  const response = await fetchFn(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const output = extractResponseText(data);

  if (!output) {
    throw new Error("No output_text returned from model");
  }

  return output.trim();
}

/**
 * Scores a text block from 1-10 based on an author profile and grading prompt.
 * Returns a single integer where 10 is best.
 *
 * @param {string|number} authorProfile Author id (for example "aria") or author index (for example 0).
 * @param {string} textBlock Text to evaluate (for example, a chapter).
 * @param {string} ratingPrompt What to judge the text on.
 * @returns {Promise<number>} Integer score from 1 to 10.
 */
async function rateBookText(authorProfile, textBlock, ratingPrompt) {
  loadEnvFromFileIfNeeded();

  if (!textBlock || typeof textBlock !== "string") {
    throw new Error("textBlock must be a non-empty string");
  }

  if (!ratingPrompt || typeof ratingPrompt !== "string") {
    throw new Error("ratingPrompt must be a non-empty string");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const { author, authorMarkdown } = resolveAuthor(authorProfile);

  const input = [
    {
      role: "system",
      content:
        "You are a strict literary evaluator. Return only one integer from 1 to 10. Do not include any other words or symbols.",
    },
    {
      role: "user",
      content: `Author id: ${author.id}\n\nAuthor profile markdown:\n${authorMarkdown}\n\nScoring criteria:\n${ratingPrompt}\n\nText to score:\n${textBlock}\n\nReturn only one number from 1 to 10.`,
    },
  ];

  const fetchFn = getFetch();
  const response = await fetchFn(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const output = extractResponseText(data);

  const match = output.match(/\b(10|[1-9])\b/);
  if (!match) {
    throw new Error(`Model did not return a valid score: ${output}`);
  }

  return Number(match[1]);
}

module.exports = {
  generateResponse,
  rateBookText,
};
