const $ = (id) => document.getElementById(id);
const grid = $("book-grid");
const libraryEl = $("library");
const readerEl = $("reader");
const tocEl = $("toc");
const chapterEl = $("chapter");

// Demo mode: opened from disk, so there is no server to read books from.
const DEMO = location.protocol === "file:";
const DEMO_BOOKS = [
  {
    id: "demo",
    title: "The Magic Cat",
    author: "Aria",
    description: "A sample book shown in demo mode.",
    chapters: [
      { title: "Chapter 1", file: "c1", wordCount: 42 },
      { title: "Chapter 2", file: "c2", wordCount: 30 },
    ],
  },
];
const DEMO_TEXT = {
  c1: "# A Cat Appears\n\nOnce upon a time there was a **magic** cat with *silver* whiskers.\n\n- It purred\n- It vanished\n\n> Not all cats are ordinary.",
  c2: "## The Spell\n\nThe cat said `abracadabra` and the moon blinked.\n\nSee [Bookify](https://example.com).",
};

let book = null;
let current = 0;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

// Small markdown renderer: headings, lists, quotes, code blocks, rules, paragraphs.
function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (/^```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    } else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      i++;
    } else if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push("<hr>");
      i++;
    } else if (/^>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(q.join(" "))}</blockquote>`);
    } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""))}</li>`);
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
    } else if (line.trim() === "") {
      i++;
    } else {
      const p = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|>|```|\s*([-*]|\d+\.)\s)/.test(lines[i])) p.push(lines[i++]);
      out.push(`<p>${inline(p.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

async function loadLibrary() {
  const books = DEMO ? DEMO_BOOKS : await getJson("/api/books");
  grid.innerHTML = "";
  $("empty").classList.toggle("hidden", books.length > 0);
  for (const b of books) {
    const words = (b.chapters || []).reduce((n, c) => n + (c.wordCount || 0), 0);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "book-card";
    card.innerHTML = `
      <div class="book-cover">${escapeHtml((b.title || "?").charAt(0))}</div>
      <div class="book-info">
        <h3>${escapeHtml(b.title || "Untitled")}</h3>
        <span class="by">by ${escapeHtml(b.author || "Unknown")}</span>
        <p>${escapeHtml(b.description || "")}</p>
        <span class="meta">${(b.chapters || []).length} chapters · ${words.toLocaleString()} words</span>
      </div>`;
    card.addEventListener("click", () => openBook(b));
    grid.appendChild(card);
  }
}

function openBook(b) {
  book = b;
  $("book-title").textContent = b.title || "Untitled";
  $("book-author").textContent = `by ${b.author || "Unknown"}`;
  $("book-desc").textContent = b.description || "";
  tocEl.innerHTML = "";
  (b.chapters || []).forEach((c, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button">${escapeHtml(c.title)}<small>${c.wordCount ?? 0} words</small></button>`;
    li.firstChild.addEventListener("click", () => showChapter(idx));
    tocEl.appendChild(li);
  });
  libraryEl.classList.add("hidden");
  readerEl.classList.remove("hidden");
  showChapter(0);
}

async function showChapter(idx) {
  const chapters = book.chapters || [];
  if (!chapters.length) {
    chapterEl.innerHTML = "<p>This book has no chapters.</p>";
    return;
  }
  current = idx;
  [...tocEl.children].forEach((li, n) => li.classList.toggle("active", n === idx));
  $("prev").disabled = idx === 0;
  $("next").disabled = idx === chapters.length - 1;
  const c = chapters[idx];
  chapterEl.innerHTML = "<p class='subtitle'>Loading…</p>";
  try {
    const md = DEMO
      ? DEMO_TEXT[c.file]
      : await (await fetch(`/api/books/${encodeURIComponent(book.id)}/chapters/${encodeURIComponent(c.file)}`)).text();
    chapterEl.innerHTML = `<h2 class="chapter-title">${escapeHtml(c.title)}</h2>` + renderMarkdown(md);
    chapterEl.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    chapterEl.innerHTML = "<p>Could not load this chapter.</p>";
  }
}

$("back").addEventListener("click", () => {
  readerEl.classList.add("hidden");
  libraryEl.classList.remove("hidden");
});
$("prev").addEventListener("click", () => showChapter(current - 1));
$("next").addEventListener("click", () => showChapter(current + 1));

loadLibrary().catch(() => {
  $("empty").textContent = "Could not load books.";
  $("empty").classList.remove("hidden");
});
