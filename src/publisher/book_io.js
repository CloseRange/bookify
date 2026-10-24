const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

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
		descritpion: "",
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
	meta.descritpion = description;
	writeMeta(metaPath, meta);
}

function setCoverImage(uuid, coverImage) {
	const { metaPath, meta } = readMeta(uuid);
	meta.coverImage = coverImage;
	writeMeta(metaPath, meta);
}

function addChapter(uuid, number, title, content) {
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
	const bookPath = path.dirname(metaPath);
	const file = `${String(number).padStart(3, "0")}.md`;
	const chapterPath = path.join(bookPath, file);

	fs.writeFileSync(chapterPath, content);

	const trimmed = content.trim();
	const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

	if (!Array.isArray(meta.chapters)) {
		meta.chapters = [];
	}

	meta.chapters.push({
		title,
		wordCount,
		file,
	});

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

module.exports = {
	generateUuid,
	makeBookFolder,
	setAuthor,
	setTitle,
	setDescription,
	setCoverImage,
	addChapter,
	saveCoverImage,
};
