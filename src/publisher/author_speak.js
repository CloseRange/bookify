const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const AUTHORS_JSON_PATH = path.join(__dirname, "..", "authors", "authors.json");
const ROOT_ENV_PATH = path.join(__dirname, "..", "..", ".env");
const CACHE_FILE_PATH = path.join(__dirname, "..", "..", "cache", "author_speak_cache.json");
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function getEnvValue(keys) {
  for (const key of keys) {
    if (process.env[key] !== undefined) {
      return process.env[key];
    }
  }

  return undefined;
}

function parseEnvBoolean(rawValue, defaultValue = false) {
  if (rawValue === undefined || rawValue === null) {
    return defaultValue;
  }

  const value = String(rawValue).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return defaultValue;
}

function getCacheConfig() {
  const cacheResultsRaw = getEnvValue(["CACHE_RESULTS", "cache_results"]);
  const useCacheRaw = getEnvValue(["USE_CACHE", "use_cache"]);

  return {
    cacheResults: parseEnvBoolean(cacheResultsRaw, false),
    useCache: parseEnvBoolean(useCacheRaw, false),
  };
}

function readCacheFile() {
  if (!fs.existsSync(CACHE_FILE_PATH)) {
    return { version: 1, entries: {} };
  }

  try {
    const raw = fs.readFileSync(CACHE_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { version: 1, entries: {} };
    }
    if (!parsed.entries || typeof parsed.entries !== "object") {
      return { version: 1, entries: {} };
    }

    return parsed;
  } catch (_error) {
    return { version: 1, entries: {} };
  }
}

function writeCacheFile(cacheData) {
  fs.mkdirSync(path.dirname(CACHE_FILE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2));
}

function buildCacheKey(payload) {
  const raw = JSON.stringify(payload);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getCachedEntry(cacheKey, bucketKey) {
  const cacheData = readCacheFile();
  const exact = cacheData.entries[cacheKey] || null;
  if (exact) {
    return exact;
  }

  return null;
}

function setCachedEntry(cacheKey, entry, bucketKey) {
  const cacheData = readCacheFile();


  cacheData.entries[cacheKey] = {
    ...entry,
    bucketKey: bucketKey || null,
    cachedAt: new Date().toISOString(),
  };
  writeCacheFile(cacheData);
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(rawValue, fallback, min, max) {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  if (parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

function getApiRetryConfig() {
  const maxAttempts = parsePositiveInt(process.env.BOOKIFY_API_MAX_ATTEMPTS, 3, 1, 8);
  const baseDelayMs = parsePositiveInt(process.env.BOOKIFY_API_RETRY_BASE_MS, 400, 100, 5000);
  const maxDelayMs = parsePositiveInt(process.env.BOOKIFY_API_RETRY_MAX_MS, 8000, 500, 30000);
  return { maxAttempts, baseDelayMs, maxDelayMs };
}

function parseOpenAiErrorBody(raw) {
  if (!raw) {
    return { parsed: null, message: "" };
  }
  try {
    const parsed = JSON.parse(raw);
    const message = parsed?.error?.message || raw;
    return { parsed, message };
  } catch (_error) {
    return { parsed: null, message: raw };
  }
}

function getRetryAfterMs(headers) {
  const retryAfter = headers?.get?.("retry-after");
  if (!retryAfter) {
    return null;
  }
  const asNumber = Number(retryAfter);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.round(asNumber * 1000);
  }
  const asDate = Date.parse(retryAfter);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return null;
}

function isRetryableOpenAiFailure(status, parsedError) {
  if (!RETRYABLE_STATUS_CODES.has(status)) {
    return false;
  }
  const code = String(parsedError?.error?.code || "").toLowerCase();
  const type = String(parsedError?.error?.type || "").toLowerCase();
  if (code === "credit_balance_exhausted" || code === "insufficient_quota") {
    return false;
  }
  if (type === "insufficient_quota") {
    return false;
  }
  return true;
}

function computeBackoffDelayMs(attempt, baseDelayMs, maxDelayMs, retryAfterMs) {
  if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return Math.min(maxDelayMs, retryAfterMs);
  }
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = Math.floor(Math.random() * Math.max(100, Math.floor(baseDelayMs / 2)));
  return Math.min(maxDelayMs, exponential + jitter);
}

async function postJsonWithRetries(url, payload, { requestLabel = "OpenAI request", authorId = "unknown" } = {}) {
  const fetchFn = getFetch();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const retryConfig = getApiRetryConfig();
  let lastError = null;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return await response.json();
      }

      const errorBody = await response.text();
      const { parsed, message } = parseOpenAiErrorBody(errorBody);
      const reason = `${requestLabel} failed for ${authorId}: ${response.status} ${message}`;
      const retryable = isRetryableOpenAiFailure(response.status, parsed);
      const retryAfterMs = getRetryAfterMs(response.headers);

      if (!retryable || attempt >= retryConfig.maxAttempts) {
        throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
      }

      const delayMs = computeBackoffDelayMs(attempt, retryConfig.baseDelayMs, retryConfig.maxDelayMs, retryAfterMs);
      console.warn(`${reason}; retrying in ${delayMs}ms (attempt ${attempt + 1}/${retryConfig.maxAttempts})`);
      await sleep(delayMs);
      continue;
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      const networkRetryable = /network|timed out|socket|econnreset|enotfound|eai_again|fetch failed/i.test(message);
      const shouldRetry = networkRetryable && attempt < retryConfig.maxAttempts;
      if (!shouldRetry) {
        throw error;
      }
      const delayMs = computeBackoffDelayMs(attempt, retryConfig.baseDelayMs, retryConfig.maxDelayMs, null);
      console.warn(`${requestLabel} transport error for ${authorId}: ${message}; retrying in ${delayMs}ms (attempt ${attempt + 1}/${retryConfig.maxAttempts})`);
      lastError = error;
      await sleep(delayMs);
    }
  }

  throw lastError || new Error(`${requestLabel} failed after retries`);
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

function truncateForOpenAiPrompt(value, maxChars = 25000) {
  const text = typeof value === "string" ? value : String(value ?? "");
  if (!text) {
    return "";
  }

  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 140).trim()}\n...[TRUNCATED for API length limits]`;
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
async function generateResponse(authorProfile, generationPrompt, { onCacheMetadata, responseFormat } = {}) {
  loadEnvFromFileIfNeeded();

  if (!generationPrompt || typeof generationPrompt !== "string") {
    throw new Error("generationPrompt must be a non-empty string");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const { cacheResults, useCache } = getCacheConfig();

  const { author, authorMarkdown } = resolveAuthor(authorProfile);
  const bucketKey = `generateResponse:${model}:${author.id}`;
  const cacheKey = buildCacheKey({
    type: "generateResponse",
    model,
    authorId: author.id,
    authorMarkdown,
    generationPrompt,
    responseFormat: responseFormat || null,
  });
  const currentMetadata = { hit: false, enabled: useCache, cacheKey, bucketKey, authorId: author.id, model, kind: "generateResponse" };
  generateResponse.lastCacheMetadata = currentMetadata;

  if (!useCache) {
    onCacheMetadata?.({ ...currentMetadata, enabled: false });
  } else {
    const cached = getCachedEntry(cacheKey, bucketKey);
    if (cached && typeof cached.value === "string") {
      const hitMetadata = { ...currentMetadata, hit: true, enabled: true };
      generateResponse.lastCacheMetadata = hitMetadata;
      onCacheMetadata?.(hitMetadata);
      return cached.value;
    }

    onCacheMetadata?.({ ...currentMetadata, hit: false, enabled: true });
  }

  const input = [
    {
      role: "system",
      content:
        authorMarkdown,
    },
    {
      role: "user",
      content: `Author id: ${author.id}\n\nRequest:\n${generationPrompt}`,
    },
  ];

  const payload = {
    model,
    input,
  };
  if (responseFormat) {
    payload.text = {
      format: typeof responseFormat === "string"
        ? { type: responseFormat }
        : responseFormat,
    };
  }

  const data = await postJsonWithRetries(OPENAI_API_URL, payload, {
    requestLabel: "generateResponse",
    authorId: author.id,
  });
  const output = extractResponseText(data);

  if (!output) {
    throw new Error("No output_text returned from model");
  }

  if (cacheResults) {
    setCachedEntry(cacheKey, {
      type: "string",
      value: output.trim(),
    }, bucketKey);
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
  const { cacheResults, useCache } = getCacheConfig();

  const { author, authorMarkdown } = resolveAuthor(authorProfile);
  const bucketKey = `rateBookText:${model}:${author.id}`;
  const cacheKey = buildCacheKey({
    type: "rateBookText",
    model,
    authorId: author.id,
    authorMarkdown,
    textBlock,
    ratingPrompt,
  });

  if (useCache) {
    const cached = getCachedEntry(cacheKey, bucketKey);
    if (cached && typeof cached.value === "number") {
      return cached.value;
    }
  }

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

  const data = await postJsonWithRetries(OPENAI_API_URL, {
    model,
    input,
  }, {
    requestLabel: "rateBookText",
    authorId: author.id,
  });
  const output = extractResponseText(data);

  const match = output.match(/\b(10|[1-9])\b/);
  if (!match) {
    throw new Error(`Model did not return a valid score: ${output}`);
  }

  const score = Number(match[1]);

  if (cacheResults) {
    setCachedEntry(cacheKey, {
      type: "number",
      value: score,
    }, bucketKey);
  }

  return score;
}

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
// Portrait 2:3 ratio, the standard book cover proportion supported by gpt-image-1.
const IMAGE_SIZE = "1024x1536";

/**
 * Generates a tall (2:3, 1024x1536) image from a prompt, using the author's profile as creative context.
 *
 * @param {string|number} authorProfile Author id (for example "aria") or author index (for example 0).
 * @param {string} imagePrompt Description of the image to generate.
 * @param {string} [outputPath] Optional file path to save the PNG to.
 * @returns {Promise<Buffer>} PNG image data.
 */
async function generateImage(authorProfile, imagePrompt, outputPath) {
  loadEnvFromFileIfNeeded();

  if (!imagePrompt || typeof imagePrompt !== "string") {
    throw new Error("imagePrompt must be a non-empty string");
  }

  const { author, authorMarkdown } = resolveAuthor(authorProfile);
  const model = (process.env.OPENAI_IMAGE_MODEL || "").trim();
  if (!model) {
    throw new Error(
      "OPENAI_IMAGE_MODEL is not configured. Set it to a valid image-capable model (for example, gpt-image-1) and make sure your OpenAI account has image generation enabled."
    );
  }
  const { cacheResults, useCache } = getCacheConfig();

  const safeAuthorMarkdown = truncateForOpenAiPrompt(authorMarkdown, 4000);
  const safeImagePrompt = truncateForOpenAiPrompt(imagePrompt, 22000);
  const prompt = `Author profile (use only as stylistic and thematic inspiration):\n${safeAuthorMarkdown}\n\nImage to create:\n${safeImagePrompt}`;
  const bucketKey = `generateImage:${model}:${IMAGE_SIZE}:${author.id}`;
  const cacheKey = buildCacheKey({
    type: "generateImage",
    model,
    size: IMAGE_SIZE,
    authorId: author.id,
    authorMarkdown: safeAuthorMarkdown,
    imagePrompt: safeImagePrompt,
  });

  const maxApiPromptLength = 32000;
  const finalPrompt = prompt.length <= maxApiPromptLength ? prompt : truncateForOpenAiPrompt(prompt, maxApiPromptLength);

  if (useCache) {
    const cached = getCachedEntry(cacheKey, bucketKey);
    if (cached && typeof cached.value === "string") {
      const cachedBuffer = Buffer.from(cached.value, "base64");
      if (outputPath) {
        fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
        fs.writeFileSync(outputPath, cachedBuffer);
      }
      return cachedBuffer;
    }
  }

  const data = await postJsonWithRetries(OPENAI_IMAGES_URL, {
    model,
    prompt: finalPrompt,
    size: IMAGE_SIZE,
    n: 1,
  }, {
    requestLabel: "generateImage",
    authorId: author.id,
  }).catch((error) => {
    const message = error && error.message ? error.message : String(error);
    const isInvalidModel = /model.*(does not exist|invalid_value|not found)|invalid.*model/i.test(message);
    if (isInvalidModel) {
      throw new Error(
        `OpenAI image API error for ${author.id}: the configured model "${model}" is not available to this account. Set OPENAI_IMAGE_MODEL to a valid image-capable model and confirm image generation is enabled for your API key/account.`
      );
    }
    throw error;
  });
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image returned from model");
  }

  const buffer = Buffer.from(b64, "base64");

  if (cacheResults) {
    setCachedEntry(cacheKey, {
      type: "base64",
      value: b64,
    }, bucketKey);
  }

  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(outputPath, buffer);
  }

  return buffer;
}

module.exports = {
  generateResponse,
  rateBookText,
  generateImage,
};
