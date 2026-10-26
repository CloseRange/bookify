const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

function enforceStoryStateValidation() {
	return process.env.BOOKIFY_ENFORCE_STORY_STATE === "1";
}

function generateUuid() {
	return randomUUID();
}

function makeBookFolder() {
	const booksRoot = path.join(__dirname, "..", "books");
	fs.mkdirSync(booksRoot, { recursive: true });

	let bookId = generateUuid();
	let bookPath = path.join(booksRoot, bookId);

	// Extremely unlikely, but avoid collisions if one ever happens.
	while (fs.existsSync(bookPath)) {
		bookId = generateUuid();
		bookPath = path.join(booksRoot, bookId);
	}

	fs.mkdirSync(bookPath, { recursive: false });

	const metaPath = path.join(bookPath, "meta.json");
	const meta = {
		title: "",
		author: "",
		originalDescription: "",
		bookDescription: "",
		description: "",
		storyBible: "",
		chapterOutline: "",
		coverImage: "",
		chapters: [],
	};
	fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

	return bookId;
}

function getMetaPath(uuid) {
	if (!uuid || typeof uuid !== "string") {
		throw new Error("uuid must be a non-empty string");
	}

	return path.join(__dirname, "..", "books", uuid, "meta.json");
}

function readMeta(uuid) {
	const metaPath = getMetaPath(uuid);
	if (!fs.existsSync(metaPath)) {
		throw new Error(`meta.json not found for uuid: ${uuid}`);
	}

	const raw = fs.readFileSync(metaPath, "utf8");
	return { metaPath, meta: JSON.parse(raw) };
}

function writeMeta(metaPath, meta) {
	fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

function setAuthor(uuid, author) {
	const { metaPath, meta } = readMeta(uuid);
	meta.author = author;
	writeMeta(metaPath, meta);
}

function setTitle(uuid, title) {
	const { metaPath, meta } = readMeta(uuid);
	meta.title = title;
	writeMeta(metaPath, meta);
}

function setDescription(uuid, description) {
	const { metaPath, meta } = readMeta(uuid);
	meta.description = description || "";
	delete meta.descritpion;
	writeMeta(metaPath, meta);
}

function setBookDescription(uuid, bookDescription) {
	const { metaPath, meta } = readMeta(uuid);
	meta.originalDescription = bookDescription || "";
	meta.bookDescription = bookDescription || "";
	writeMeta(metaPath, meta);
}

function setOriginalDescription(uuid, originalDescription) {
	const { metaPath, meta } = readMeta(uuid);
	meta.originalDescription = originalDescription || "";
	meta.bookDescription = originalDescription || "";
	writeMeta(metaPath, meta);
}

function setStoryBible(uuid, storyBible) {
	const { metaPath, meta } = readMeta(uuid);
	meta.storyBible = storyBible || "";
	writeMeta(metaPath, meta);
}

function setChapterOutline(uuid, chapterOutline) {
	const { metaPath, meta } = readMeta(uuid);
	meta.chapterOutline = chapterOutline || "";
	writeMeta(metaPath, meta);
}

function setCoverImage(uuid, coverImage) {
	const { metaPath, meta } = readMeta(uuid);
	meta.coverImage = coverImage;
	writeMeta(metaPath, meta);
}

function addChapter(uuid, number, title, content, storyState, validation, diagnostics) {
	if (!Number.isInteger(number) || number < 1) {
		throw new Error("number must be a positive integer");
	}

	if (typeof title !== "string") {
		throw new Error("title must be a string");
	}

	if (typeof content !== "string") {
		throw new Error("content must be a string");
	}

	const { metaPath, meta } = readMeta(uuid);
	if (!Array.isArray(meta.chapters)) {
		meta.chapters = [];
	}
	if (meta.chapters.length !== number - 1) {
		throw new Error("Accepted chapters must be sequential");
	}
	if (storyState && storyState.chapters?.at(-1)?.number !== number) {
		throw new Error("Story state and chapter number do not align");
	}
	if (storyState) {
		if (enforceStoryStateValidation()) {
			require('./narrative').validateStoryState(storyState, number, content);
		} else {
			try {
				require('./narrative').validateStoryState(storyState, number, content);
			} catch (error) {
				console.warn(`Non-blocking story-state save warning for chapter ${number}: ${error.message}`);
			}
		}
	}
	const bookPath = path.dirname(metaPath);
	const file = `${String(number).padStart(3, "0")}.md`;
	const chapterPath = path.join(bookPath, file);

	if (fs.existsSync(chapterPath)) throw new Error(`Chapter ${number} file already exists`);
	fs.writeFileSync(chapterPath, content);

	const trimmed = content.trim();
	const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

	meta.chapters.push({
		number,
		title,
		wordCount,
		file,
		...(validation ? {validation} : {}),
		...(diagnostics ? { diagnostics } : {}),
	});
    if (storyState) meta.storyState = storyState;

	writeMeta(metaPath, meta);
}

function setNarrativeAudit(uuid, report) {
    if (!report.passed && !report.advisory) throw new Error("Cannot mark failed manuscript audit complete");
    const {metaPath, meta} = readMeta(uuid);
    meta.narrativeAudit = report;
    writeMeta(metaPath, meta);
}

function setPipelineDiagnostics(uuid, diagnostics) {
	const { metaPath, meta } = readMeta(uuid);
	meta.pipelineDiagnostics = diagnostics || {};
	writeMeta(metaPath, meta);
}

function saveCoverImage(uuid, imageBuffer, fileName = "cover.png") {
	if (!Buffer.isBuffer(imageBuffer)) {
		throw new Error("imageBuffer must be a Buffer");
	}

	if (!fileName || typeof fileName !== "string") {
		throw new Error("fileName must be a non-empty string");
	}

	const { metaPath, meta } = readMeta(uuid);
	const bookPath = path.dirname(metaPath);
	const imagePath = path.join(bookPath, fileName);

	fs.writeFileSync(imagePath, imageBuffer);

	meta.coverImage = fileName;
	writeMeta(metaPath, meta);

	return fileName;
}

function writeFullBook(uuid) {
	const { metaPath, meta } = readMeta(uuid);
	const bookPath = path.dirname(metaPath);
	const title = meta.title || "Untitled Book";
	const chapters = Array.isArray(meta.chapters) ? meta.chapters : [];

	const fullBookPath = path.join(bookPath, "full_book.md");
	if (chapters.length === 0) {
		fs.writeFileSync(fullBookPath, `# ${title}\n\n`);
		return fullBookPath;
	}

	const sections = [`# ${title}`];
	for (const chapter of chapters) {
		const chapterNumber = Number(chapter.number ?? 1);
		const chapterFile = chapter.file || `${String(chapterNumber).padStart(3, "0")}.md`;
		const fullFilePath = path.join(bookPath, chapterFile);
		const chapterContent = fs.existsSync(fullFilePath)
			? fs.readFileSync(fullFilePath, "utf8").trim()
			: "";
		const chapterTitle = chapter.title || `Chapter ${chapterNumber}`;
		sections.push(`\n## ${chapterTitle}\n\n${chapterContent}`);
	}

	fs.writeFileSync(fullBookPath, sections.join("\n\n"));
	return fullBookPath;
}

module.exports = {
	generateUuid,
	makeBookFolder,
	setAuthor,
	setTitle,
	readMeta,
	setDescription,
	setBookDescription,
	setOriginalDescription,
	setStoryBible,
	setChapterOutline,
	setCoverImage,
	addChapter,
    setNarrativeAudit,
	setPipelineDiagnostics,
	saveCoverImage,
	writeFullBook,
};
