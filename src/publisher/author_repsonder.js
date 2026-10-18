const OPENAI_API_URL = "https://api.openai.com/v1/responses";

/**
 * Sends author context + a generation request to an AI model and returns text output.
 *
 * @param {object|string} authorProfile Full author personality and stats.
 * @param {string} generationPrompt Prompt such as "Generate me X, Y, Z".
 * @returns {Promise<string>} Model response text.
 */
async function generateBookResponse(authorProfile, generationPrompt) {
  if (!authorProfile) {
    throw new Error("authorProfile is required");
  }

  if (!generationPrompt || typeof generationPrompt !== "string") {
    throw new Error("generationPrompt must be a non-empty string");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const authorJson =
    typeof authorProfile === "string"
      ? authorProfile
      : JSON.stringify(authorProfile, null, 2);

  const input = [
    {
      role: "system",
      content:
        "You are an expert ghostwriter. Follow the author profile closely when generating output.",
    },
    {
      role: "user",
      content: `Author profile:\n${authorJson}\n\nRequest:\n${generationPrompt}`,
    },
  ];

  const response = await fetch(OPENAI_API_URL, {
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
  const output = data.output_text;

  if (!output) {
    throw new Error("No output_text returned from model");
  }

  return output.trim();
}

/**
 * Scores a text block from 1-10 based on an author profile and grading prompt.
 * Returns a single integer where 10 is best.
 *
 * @param {object|string} authorProfile Full author personality and stats.
 * @param {string} textBlock Text to evaluate (for example, a chapter).
 * @param {string} ratingPrompt What to judge the text on.
 * @returns {Promise<number>} Integer score from 1 to 10.
 */
async function rateBookText(authorProfile, textBlock, ratingPrompt) {
  if (!authorProfile) {
    throw new Error("authorProfile is required");
  }

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

  const authorJson =
    typeof authorProfile === "string"
      ? authorProfile
      : JSON.stringify(authorProfile, null, 2);

  const input = [
    {
      role: "system",
      content:
        "You are a strict literary evaluator. Return only one integer from 1 to 10. Do not include any other words or symbols.",
    },
    {
      role: "user",
      content: `Author profile:\n${authorJson}\n\nScoring criteria:\n${ratingPrompt}\n\nText to score:\n${textBlock}\n\nReturn only one number from 1 to 10.`,
    },
  ];

  const response = await fetch(OPENAI_API_URL, {
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
  const output = (data.output_text || "").trim();

  const match = output.match(/\b(10|[1-9])\b/);
  if (!match) {
    throw new Error(`Model did not return a valid score: ${output}`);
  }

  return Number(match[1]);
}

module.exports = {
  generateBookResponse,
  rateBookText,
};
