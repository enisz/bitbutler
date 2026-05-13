---
name: Issue #74 docs - cancelled
description: The docs app (packages/docs) was removed entirely; issue #74 work is abandoned
type: project
---

Issue #74 (documentation site content) is cancelled. The entire `packages/docs/` package has been deleted from the monorepo. All related CI workflows (`deploy-docs.yml`), workflow steps, and configuration references have been removed.

**Why:** User decided a documentation site adds no value for a simple torrent client.

**How to apply:** Do not reference packages/docs, docs:dev, docs:build, or issue #74 documentation work in future conversations. The branch 74-docs should be closed/abandoned.
