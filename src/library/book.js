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
    fetch(`${BOOKS_BASE}/${bookId}/full_book.md`).then((response) => {
      if (!response.ok) throw new Error('Missing book content');
      return response.text();
    }),
  ]);

  const title = meta.title?.trim() || (markdown.match(/^#\s+(.+)/m)?.[1] || 'Untitled');
  const fallbackDescription = meta.description || meta.bookDescription || meta.originalDescription || 'A story to explore.';

  bookReader.innerHTML = `
    <header class="book-reader-header">
      <h1>${title}</h1>
      <p>${fallbackDescription}</p>
    </header>
    <div class="book-reader-body">${renderMarkdown(markdown)}</div>
  `;
}

loadBook().catch((error) => {
  console.error(error);
  bookReader.innerHTML = '<div class="empty-state">This book could not be loaded.</div>';
});
