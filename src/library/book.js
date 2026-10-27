const bookReader = document.querySelector('#bookReader');
const params = new URLSearchParams(window.location.search);
const bookId = params.get('id');
const BOOKS_BASE = '../books';
const IS_FILE_PROTOCOL = window.location.protocol === 'file:';

function formatInline(value) {
  return value
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function renderMarkdown(markdown) {
  const blocks = markdown
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const html = blocks
    .map((block) => {
      if (/^#{1,6}\s+/.test(block)) {
        const level = block.match(/^#+/)?.[0].length || 1;
        const text = block.replace(/^#{1,6}\s+/, '');
        return `<h${level}>${formatInline(text)}</h${level}>`;
      }

      if (/^[-*]\s+/.test(block)) {
        const items = block
          .split(/\n/)
          .map((line) => line.replace(/^[-*]\s+/, '').trim())
          .filter(Boolean)
          .map((item) => `<li>${formatInline(item)}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }

      if (/^\d+\.\s+/.test(block)) {
        const items = block
          .split(/\n/)
          .map((line) => line.replace(/^\d+\.\s+/, '').trim())
          .filter(Boolean)
          .map((item) => `<li>${formatInline(item)}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }

      return `<p>${formatInline(block)}</p>`;
    })
    .join('');

  return html;
}

async function loadBook() {
  if (!bookId) {
    bookReader.innerHTML = '<div class="empty-state">No book selected.</div>';
    return;
  }

  if (IS_FILE_PROTOCOL) {
    const meta = window.BOOKIFY_BOOK_CATALOG?.[bookId];
    if (!meta) {
      throw new Error('Missing static book catalog entry');
    }

    const title = meta.title?.trim() || bookId;
    const fallbackDescription = meta.description || meta.bookDescription || meta.originalDescription || 'A story to explore.';
    const chapters = Array.isArray(meta.chapters) ? meta.chapters : [];
    const chapterLinks = chapters
      .map((chapter) => {
        const file = chapter?.file;
        const chapterTitle = chapter?.title || file || 'Chapter';
        if (!file) return `<li>${chapterTitle}</li>`;
        return `<li><a href="${BOOKS_BASE}/${bookId}/${file}" target="_blank" rel="noopener">${chapterTitle}</a></li>`;
      })
      .join('');

    bookReader.innerHTML = `
      <header class="book-reader-header">
        <h1>${title}</h1>
        <p>${fallbackDescription}</p>
      </header>
      <div class="book-reader-body">
        <p>Direct file mode cannot load markdown with fetch due browser security rules.</p>
        <p><a href="${BOOKS_BASE}/${bookId}/full_book.md" target="_blank" rel="noopener">Open full book markdown</a></p>
        ${chapters.length > 0 ? `<h2>Chapters</h2><ul>${chapterLinks}</ul>` : ''}
      </div>
    `;
    return;
  }

  const [meta, markdown] = await Promise.all([
    fetch(`${BOOKS_BASE}/${bookId}/meta.json`).then((response) => {
      if (!response.ok) throw new Error('Missing book metadata');
      return response.json();
    }),
    fetch(`${BOOKS_BASE}/${bookId}/full_book.md`)
      .then((response) => (response.ok ? response.text() : ''))
      .catch(() => ''),
  ]);

  const title = meta.title?.trim() || (markdown.match(/^#\s+(.+)/m)?.[1] || 'Untitled');
  const fallbackDescription = meta.description || meta.bookDescription || meta.originalDescription || 'A story to explore.';
  const chapters = (Array.isArray(meta.chapters) ? meta.chapters : []).filter((chapter) => chapter?.file);

  if (chapters.length === 0) {
    bookReader.innerHTML = `
      <header class="book-reader-header"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(fallbackDescription)}</p></header>
      <div class="book-reader-body">${renderMarkdown(markdown)}</div>
    `;
    return;
  }

  const cache = new Map();
  let current = Math.min(Math.max((parseInt(params.get('ch'), 10) || 1) - 1, 0), chapters.length - 1);

  async function getChapterText(index) {
    const file = chapters[index].file;
    if (!cache.has(file)) {
      const response = await fetch(`${BOOKS_BASE}/${bookId}/${file}`);
      if (!response.ok) throw new Error('Missing chapter');
      cache.set(file, await response.text());
    }
    return cache.get(file);
  }

  let page = 0;
  let pageCount = 1;
  let step = 0;
  let pendingPage = 'start';

  bookReader.innerHTML = `
    <header class="book-reader-header">
      <h1>${escapeHtml(title)}</h1>
      ${meta.author ? `<p>by ${escapeHtml(meta.author)}</p>` : ''}
    </header>
    <div class="chapter-nav">
      <select id="chapterSelect" aria-label="Jump to chapter">${chapters
        .map((chapter, i) => `<option value="${i}">${chapter.number || i + 1}. ${escapeHtml(chapter.title || 'Chapter')}</option>`)
        .join('')}</select>
    </div>
    <div class="book-spread"><div class="book-viewport" id="bookSpread"><div class="book-pages" id="bookPages"></div></div></div>
    <div class="page-controls">
      <button type="button" id="prevPage">← Previous</button>
      <span id="pageInfo"></span>
      <button type="button" id="nextPage">Next →</button>
    </div>
  `;

  const spread = bookReader.querySelector('#bookSpread');
  const pagesEl = bookReader.querySelector('#bookPages');
  const prevBtn = bookReader.querySelector('#prevPage');
  const nextBtn = bookReader.querySelector('#nextPage');
  const info = bookReader.querySelector('#pageInfo');
  const select = bookReader.querySelector('#chapterSelect');

  function updateControls() {
    pagesEl.style.transform = `translateX(${-page * step}px)`;
    const atEnd = page >= pageCount - 1;
    const lastChapter = current === chapters.length - 1;
    info.textContent = `Chapter ${current + 1} of ${chapters.length} · Page ${page + 1} of ${pageCount}`;
    prevBtn.disabled = page === 0 && current === 0;
    nextBtn.disabled = atEnd && lastChapter;
    nextBtn.textContent = atEnd ? (lastChapter ? 'The End' : 'Next chapter →') : 'Next →';
    nextBtn.classList.toggle('highlight', atEnd && !lastChapter);
    select.value = String(current);
  }

  // Lay text out in fixed-size columns; each column (or pair of columns) is one page.
  function layout() {
    const width = spread.clientWidth;
    const columns = width >= 820 ? 2 : 1;
    const gap = columns === 2 ? 64 : 0;
    const colWidth = (width - gap * (columns - 1)) / columns;
    pagesEl.style.height = `${spread.clientHeight}px`;
    pagesEl.style.columnWidth = `${colWidth}px`;
    pagesEl.style.columnGap = `${gap}px`;
    pagesEl.style.columnFill = 'auto';
    step = width + gap;
    pageCount = Math.max(1, Math.ceil((pagesEl.scrollWidth + gap) / step - 0.01));
    page = Math.min(page, pageCount - 1);
    updateControls();
  }

  async function showChapter(index) {
    current = index;
    const chapter = chapters[index];
    let body;
    try {
      body = renderMarkdown(await getChapterText(index));
    } catch {
      body = '<div class="empty-state">This chapter could not be loaded.</div>';
    }

    pagesEl.innerHTML = `
      <h2 class="chapter-title">Chapter ${chapter.number || index + 1}<span>${escapeHtml(chapter.title || '')}</span></h2>
      ${body}
    `;
    page = 0;
    layout();
    if (pendingPage === 'end') page = pageCount - 1;
    pendingPage = 'start';
    updateControls();

    document.title = `${title} – Chapter ${index + 1}`;
    history.replaceState(null, '', `?id=${encodeURIComponent(bookId)}&ch=${index + 1}`);
  }

  function nextPage() {
    if (page < pageCount - 1) {
      page += 1;
      updateControls();
    } else if (current < chapters.length - 1) {
      showChapter(current + 1);
    }
  }

  function prevPage() {
    if (page > 0) {
      page -= 1;
      updateControls();
    } else if (current > 0) {
      pendingPage = 'end';
      showChapter(current - 1);
    }
  }

  nextBtn.addEventListener('click', nextPage);
  prevBtn.addEventListener('click', prevPage);
  select.addEventListener('change', () => showChapter(Number(select.value)));
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('select')) return;
    if (event.key === 'ArrowRight') nextPage();
    if (event.key === 'ArrowLeft') prevPage();
  });
  window.addEventListener('resize', layout);

  await showChapter(current);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

loadBook().catch((error) => {
  console.error(error);
  bookReader.innerHTML = '<div class="empty-state">This book could not be loaded.</div>';
});
