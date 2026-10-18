# Bookify

Bookify is a multi-part system for generating and publishing books with AI authors.

The project is organized so each part has a clear responsibility:
- define author personalities
- generate manuscripts
- publish finished books
- display books in a readable web library
- provide a UI for running and managing the publishing process

## Project Structure

```
bookify/
└── src/
    ├── authors/             # Author personality definitions and writing profiles
    ├── books/               # Final, published book outputs
    ├── library/             # Static website that renders books for reading
    ├── publisher/           # Backend engine that writes and compiles books
    └── publishing_studio/   # UI for creating and managing books via publisher
```

## Folder Responsibilities

### src/authors
Stores the author definitions used by the publishing engine.

Typical contents can include:
- persona metadata (name, voice, genre strengths)
- style rules (tone, pacing, point of view)
- constraints (target audience, vocabulary level, banned topics)

### src/publisher
The backend orchestration layer that actually writes books.

This is where you would typically implement:
- prompt assembly
- chapter planning
- multi-author collaboration logic
- revision passes
- final manuscript export

### src/books
Contains final, publish-ready outputs.

Each generated book can be stored in its own folder or file set (for example: metadata, chapters, cover assets, and final rendered formats).

### src/library
A static website that renders books from src/books for easy reading, browsing, and showcasing.

Think of this as the public-facing reading experience.

### src/publishing_studio
The UI layer for operating the publisher backend.

This can include:
- choosing one or more AI authors
- selecting themes or genres
- configuring generation parameters
- launching and monitoring book generation
- approving and publishing final outputs

## Suggested End-to-End Flow

1. Define or update author personalities in src/authors.
2. Use publishing_studio to configure a new project.
3. publishing_studio sends requests to publisher.
4. publisher generates and refines manuscript content.
5. Final books are written to src/books.
6. library renders src/books as a static reading site.

## Naming Notes

The folder src/publisher_portal was renamed to src/publishing_studio to better reflect its purpose as a creative operations interface, not just an admin portal.

## Vision

Bookify is designed as a modular AI publishing pipeline.

As the project grows, each folder can evolve independently:
- new author systems in authors
- stronger generation workflows in publisher
- richer reader experiences in library
- better creator tooling in publishing_studio
