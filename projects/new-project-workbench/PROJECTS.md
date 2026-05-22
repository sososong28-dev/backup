# Project Catalog

This workspace is intended to be uploaded to GitHub as categorized private repositories.

## Web Apps

### SharkCoach Hold'em Workbench

- Local path: `C:\Users\ho\Documents\New project`
- Suggested GitHub repo: `new-project-workbench`
- Includes: root `server.mjs`, `game/`, attendance HTML deliverables, deployment snippets, report-building scripts, and small project docs.
- Excludes by default: local runtime data, generated output, scratch APK/decompile work, and temporary OCR/render folders.

### Packaging Review

- Local path: `C:\Users\ho\Documents\New project\github-packaging-review`
- Suggested GitHub repo: `github-packaging-review`
- Includes: server-backed packaging review app, deployment docs, sample project pages, and tracked sample assets.
- Notes: this is already an independent Git repository and should be pushed separately from the workbench repo.

## Automation And Data Tools

### WDT RPA SQLite

- Local path: `C:\Users\ho\Documents\New project\wdt-rpa-sqlite`
- Suggested placement: inside `new-project-workbench` under the automation category for now.
- Includes: RPA export planning docs, SQLite schema, sample configuration, and scripts.
- Excludes by default: runtime exports, logs, and local data.

## Report And Document Builders

### Product And Weekly Report Scripts

- Local paths: `scripts/` plus top-level `build_*.py` and `build_*.mjs` files.
- Suggested placement: inside `new-project-workbench`.
- Includes: packaging/report/PPT generation helpers and reusable automation scripts.
- Excludes by default: rendered previews, generated PPTX/XLSX artifacts, and temporary extraction assets.

## Do Not Upload By Default

- `scratch/`: decompiled APKs, third-party binaries, and extracted assets.
- `output/`: generated bundles, screenshots, PPTX/XLSX outputs, logs, and preview artifacts.
- `data/`: local runtime state and imported data.
- `.codex_tmp/` and `.playwright-cli/`: Codex/browser temporary files.
- `tmp-*`: one-off working folders.

Run `scripts/publish_all_projects_to_github.ps1` after GitHub CLI authentication to create private repositories and push the tracked project code.
