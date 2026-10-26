const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const {
  startWriteBookJob,
  getWriteBookProgress,
} = require("../publisher/write_book_jobs");
const { TOTAL_BOOK_STEPS } = require("../publisher/write_book_progress");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const BOOKS_DIR = path.join(__dirname, "..", "books");
const LIBRARY_DIR = path.join(__dirname, "..", "library");
const AUTHORS_DIR = path.join(__dirname, "..", "authors");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function sendStaticFile(res, rootDir, requestedPath) {
  const normalized = path
    .normalize(requestedPath)
    .replace(/^[/\\]+/, "")
    .replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(rootDir, normalized);
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    res.end(content);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/generate") {
    try {
      const { prompt } = JSON.parse((await readBody(req)) || "{}");
      if (!prompt || !String(prompt).trim()) {
        return sendJson(res, 400, { error: "Prompt is required" });
      }
      startWriteBookJob(String(prompt).trim());
      return sendJson(res, 202, { started: true });
    } catch (error) {
      return sendJson(res, 409, { error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/progress") {
    return sendJson(res, 200, {
      ...getWriteBookProgress(),
      totalSteps: TOTAL_BOOK_STEPS,
    });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/books")) {
    const parts = url.pathname.split("/").filter(Boolean).slice(2);
    const safe = /^[\w-]+$/;
    try {
      if (parts.length === 0) {
        const entries = await fsp.readdir(BOOKS_DIR, { withFileTypes: true });
        const books = [];
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          try {
            const meta = JSON.parse(
              await fsp.readFile(path.join(BOOKS_DIR, entry.name, "meta.json"), "utf8")
            );
            books.push({ id: entry.name, ...meta });
          } catch {
            // skip folders without a valid meta.json
          }
        }
        return sendJson(res, 200, books);
      }
      if (!safe.test(parts[0])) return sendJson(res, 400, { error: "Bad book id" });
      const bookDir = path.join(BOOKS_DIR, parts[0]);

      if (parts.length === 1) {
        const meta = JSON.parse(await fsp.readFile(path.join(bookDir, "meta.json"), "utf8"));
        return sendJson(res, 200, { id: parts[0], ...meta });
      }
      if (parts.length === 3 && parts[1] === "chapters") {
        const file = parts[2];
        if (!/^[\w-]+\.md$/.test(file)) return sendJson(res, 400, { error: "Bad chapter file" });
        const text = await fsp.readFile(path.join(bookDir, file), "utf8");
        res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
        return res.end(text);
      }
      return sendJson(res, 404, { error: "Not found" });
    } catch {
      return sendJson(res, 404, { error: "Not found" });
    }
  }

  if (req.method === "GET" && (url.pathname === "/library" || url.pathname.startsWith("/library/"))) {
    const requested =
      url.pathname === "/library" || url.pathname === "/library/"
        ? "index.html"
        : url.pathname.slice("/library/".length);
    return sendStaticFile(res, LIBRARY_DIR, requested);
  }

  if (req.method === "GET" && url.pathname.startsWith("/books/")) {
    const requested = url.pathname.slice("/books/".length);
    return sendStaticFile(res, BOOKS_DIR, requested);
  }

  if (req.method === "GET" && url.pathname.startsWith("/authors/")) {
    const requested = url.pathname.slice("/authors/".length);
    return sendStaticFile(res, AUTHORS_DIR, requested);
  }

  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  return sendStaticFile(res, PUBLIC_DIR, requested);
});

server.listen(PORT, () => {
  console.log(`Publishing Studio running at http://localhost:${PORT}`);
});
