const booksGrid = document.querySelector('#booksGrid');

const BOOKS_BASE = '../books';
const IS_FILE_PROTOCOL = window.location.protocol === 'file:';

function getStaticBookIds() {
  const ids = window.BOOKIFY_BOOK_IDS;
  return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id.trim().length > 0) : [];
}

function getStaticBookMeta(id) {
  const catalog = window.BOOKIFY_BOOK_CATALOG;
  if (!catalog || typeof catalog !== 'object') return null;
  const meta = catalog[id];
  return meta && typeof meta === 'object' ? meta : null;
}

async function getBookIds() {
  if (IS_FILE_PROTOCOL) {
    return getStaticBookIds();
  }

  try {
    const ids = await fetchJson(`${BOOKS_BASE}/meta.json`);
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.filter((id) => typeof id === 'string' && id.trim().length > 0);
    }
  } catch {
    // Leave empty and render a friendly empty state when no catalog file is found.
  }

  return [];
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}

function extractTitleFromMarkdown(markdown) {
  if (!markdown) return 'Untitled';
  const match = markdown.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : 'Untitled';
}

async function loadBooks() {
  const bookIds = await getBookIds();

  if (bookIds.length === 0) {
    booksGrid.innerHTML = '<div class="empty-state">No books found yet.</div>';
    return;
  }

  const settledBooks = await Promise.allSettled(
    bookIds.map(async (id) => {
      const meta = IS_FILE_PROTOCOL ? getStaticBookMeta(id) : await fetchJson(`${BOOKS_BASE}/${id}/meta.json`);
      if (!meta) {
        throw new Error(`Missing static meta for ${id}`);
      }

      let markdownText = '';

      if (!IS_FILE_PROTOCOL) {
        try {
          markdownText = await fetch(`${BOOKS_BASE}/${id}/full_book.md`).then((response) => {
            if (!response.ok) throw new Error('Missing full book');
            return response.text();
          });
        } catch (error) {
          markdownText = '';
        }
      }

      const title = meta.title?.trim() || extractTitleFromMarkdown(markdownText) || id;
      const description = meta.description || meta.bookDescription || meta.originalDescription || 'A captivating story waiting to be read.';

      return {
        id,
        title,
        description,
        cover: `${BOOKS_BASE}/${id}/${meta.coverImage || 'coverImage.png'}`,
      };
    })
  );

  const books = settledBooks
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  if (books.length === 0) {
    booksGrid.innerHTML = '<div class="empty-state">No books found yet.</div>';
    return;
  }

  const sortedBooks = [...books].sort((a, b) => a.title.localeCompare(b.title));

  booksGrid.innerHTML = sortedBooks
    .map(
      (book) => `
        <article class="book-card">
          <a href="book.html?id=${book.id}" aria-label="Open ${book.title}">
            <img class="book-card-cover" src="${book.cover}" alt="${book.title} cover" />
          </a>
        </article>
      `
    )
    .join('');
}

async function init() {
  const [booksResult] = await Promise.allSettled([loadBooks()]);

  if (booksResult.status === 'rejected') {
    console.error(booksResult.reason);
    booksGrid.innerHTML = '<div class="empty-state">Unable to load the library right now.</div>';
  }
}

init();
