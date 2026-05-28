# Messories

> A purely vibe coded project. Built to test what end-to-end AI-assisted development actually feels like in practice.

A local-only Instagram message archive viewer. Drop in your Instagram data export and browse your full conversation history — reactions, voice notes, photos, replies, and all. Nothing ever leaves your browser.

## What it does

- Parses Instagram `.zip` data exports entirely in-browser (no server, no upload)
- Renders threaded conversations with media, voice messages, reactions, and replies
- Full-text search across all threads
- Insights panel with activity charts, call stats, and time-windowed breakdowns
- Export to markdown, PDF (print), or a zip of all photos/videos
- 9 colour palettes, font and density tweaks, PWA-installable

## Tech

React + Vite, JSZip for archive parsing, IndexedDB for archive persistence, zero backend.

## Self-hosting

```bash
npm install
npm run dev       # localhost:5173
npm run build     # static output in dist/
```

Serve the `dist/` folder from any static host (nginx, Caddy, S3, GitHub Pages).

## License

MIT — see [LICENSE](./LICENSE).
