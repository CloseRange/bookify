#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, value, "utf8");
}

function listBookFolders(projectRoot) {
  const booksRoot = path.join(projectRoot, "src", "books");
  const children = fs.readdirSync(booksRoot, { withFileTypes: true });
  return children
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^[0-9a-fA-F-]{36}$/.test(name))
    .sort();
}

function chapterWordCount(text) {
  const trimmed = String(text || "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function normalizeChapterEntries(bookDir, chapters) {
  const chapterFiles = fs
    .readdirSync(bookDir)
    .filter((name) => /^\d{3}\.md$/.test(name))
    .sort();

  const inputByNumber = new Map();
  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    const number = Number(chapter?.number);
    if (Number.isInteger(number) && number > 0) {
      inputByNumber.set(number, chapter);
      continue;
    }

    const fileMatch = String(chapter?.file || "").match(/^(\d{3})\.md$/);
    if (fileMatch) {
      inputByNumber.set(Number(fileMatch[1]), chapter);
    }
  }

  return chapterFiles.map((fileName, index) => {
    const number = index + 1;
    const source = inputByNumber.get(number) || {};
    const content = readText(path.join(bookDir, fileName));
    const title = typeof source.title === "string" && source.title.trim()
      ? source.title.trim()
      : `Chapter ${number}`;

    return {
      number,
      title,
      wordCount: chapterWordCount(content),
      file: fileName,
    };
  });
}

function normalizeBookMeta(bookDir) {
  const metaPath = path.join(bookDir, "meta.json");
  if (!fs.existsSync(metaPath)) {
    return null;
  }

  const meta = readJson(metaPath);
  const normalizedChapters = normalizeChapterEntries(bookDir, meta.chapters);
  const normalized = {
    ...meta,
    title: typeof meta.title === "string" ? meta.title : "",
    author: typeof meta.author === "string" ? meta.author : "",
    description: typeof meta.description === "string" ? meta.description : "",
    coverImage: typeof meta.coverImage === "string" ? meta.coverImage : "",
    chapters: normalizedChapters,
  };

  writeJson(metaPath, normalized);
  return normalized;
}

function buildCatalogEntry(meta) {
  return {
    title: meta.title || "",
    author: meta.author || "",
    coverImage: meta.coverImage || "",
    description: meta.description || "",
    chapters: (meta.chapters || []).map((chapter) => ({
      title: chapter.title,
      wordCount: chapter.wordCount,
      file: chapter.file,
    })),
  };
}

function writeCatalogFiles(projectRoot, ids, catalog) {
  const booksRoot = path.join(projectRoot, "src", "books");

  const catalogJsPath = path.join(booksRoot, "catalog.js");
  const catalogJs = `window.BOOKIFY_BOOK_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`;
  writeText(catalogJsPath, catalogJs);

  const bookIdsJsPath = path.join(booksRoot, "meta.js");
  const idsJs = `window.BOOKIFY_BOOK_IDS = ${JSON.stringify(ids, null, 2)};\n`;
  writeText(bookIdsJsPath, idsJs);

  const idsJsonPath = path.join(booksRoot, "meta.json");
  writeJson(idsJsonPath, ids);
}

function writeAuthorsJs(projectRoot) {
  const authorsJsonPath = path.join(projectRoot, "src", "authors", "authors.json");
  const authorsJsPath = path.join(projectRoot, "src", "authors", "authors.js");

  const authors = readJson(authorsJsonPath);
  const clientAuthors = authors.map((author) => ({
    id: author.id,
    name: author.name,
    title: author.title,
  }));

  const js = `window.BOOKIFY_AUTHORS = ${JSON.stringify(clientAuthors, null, 2)};\n`;
  writeText(authorsJsPath, js);

  return clientAuthors;
}

function syncBooksAndIndexes(projectRoot = __dirname) {
  const ids = listBookFolders(projectRoot);
  const booksRoot = path.join(projectRoot, "src", "books");

  const catalog = {};
  for (const id of ids) {
    const bookDir = path.join(booksRoot, id);
    const normalizedMeta = normalizeBookMeta(bookDir);
    if (!normalizedMeta) continue;
    catalog[id] = buildCatalogEntry(normalizedMeta);
  }

  writeCatalogFiles(projectRoot, ids, catalog);
  const authors = writeAuthorsJs(projectRoot);

  return {
    bookCount: ids.length,
    authorCount: authors.length,
    ids,
  };
}

function main() {
  const result = syncBooksAndIndexes(__dirname);
  console.log(`Synchronized ${result.bookCount} books and ${result.authorCount} authors.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  }
}

module.exports = {
  listBookFolders,
  normalizeBookMeta,
  syncBooksAndIndexes,
  writeAuthorsJs,
};
