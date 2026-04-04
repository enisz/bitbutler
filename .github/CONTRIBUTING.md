# 🤝 Contributing to BitButler

To maintain a high-quality codebase and a smooth automated release pipeline, we follow a structured development workflow. Please adhere to these guidelines to keep our "Butler" happy.

## 🔄 The Development Cycle

### 1. Start with an Issue

Every change must be tracked by an issue. This ensures we can discuss features and document bugs before code is written.

- **🪲 Bug Report:** Use for fixing broken functionality.
- **🚀 Feature Request:** Use for proposing new ideas.
- **🧰 Maintenance:** For refactoring, updating dependencies, or cleaning up technical debt.

### 2. Branching & Commit Messages

We use **Husky** and **lint-staged** to ensure code is formatted and linted before it reaches the repo. Your commit messages must reference the Issue ID.

- **Format:** `#IssueID: short description of the change`
- **Example:** `#14: implement automatic sorting for torrent grid`

### 3. Pull Requests & Automation

Our **BitButler PR Verification** workflow ensures the build never breaks. When opening a PR, follow these steps to trigger the automation:

1. **The Description:** You must include a reference to the issue using the "Fixes" keyword (e.g., `Fixes #123`). This ensures the issue closes automatically when merged.
2. **The Title:** Unlike commit messages, PR titles are flexible! Make them descriptive (e.g., `Refactor grid sorting logic`).
3. **Manual Labeling:** Apply the matching label (`bug`, `feature`, `enhancement`, or `maintenance`) to the PR.

**What the Butler does for you:** Once you save your PR, our GitHub Action will:

- Automatically fetch the **Issue Title** and add it to your description.
- Sync the **Labels** from the linked issue to your PR for the release notes.
- Run linter, unit tests, and cross-platform builds (Windows/Linux) to ensure no format breaks.

## 🚀 Build & Release Process

Releases are completely automated via GitHub Actions:

1. A maintainer runs the **Release** workflow.
2. The version bump type is selected (`patch`, `minor`, or `major`).
3. The system automatically updates `package.json`, tags the commit, and compiles the UI.
4. `electron-builder` generates all configured binaries:
   - **Windows:** NSIS Installer, Portable, and ZIP
   - **Linux:** AppImage, DEB, RPM, Snap, and Tarball
5. The freshly built binaries are automatically uploaded and attached to a drafted GitHub Release.

## 🛠 Quality Standards

- **Linting:** Ensure `npm run lint` passes before pushing.
- **Formatting:** We use **Prettier**. The pre-commit hook handles this, but you can run `npm run format` manually.
- **Testing:** Ensure `npm test` does not fail. We're aiming for high coverage as the project grows!

---

_Thank you for helping make BitButler better!_
