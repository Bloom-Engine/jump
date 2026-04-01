---
name: release
description: Commit, push, and create a GitHub release that triggers the CI/CD pipeline for all platforms.
argument-hint: "[version, e.g. 1.2.0]"
disable-model-invocation: true
allowed-tools: Bash, Read, Edit, Grep, Glob
---

Create a release for Bloom Jump. The version is: $ARGUMENTS

Follow these steps exactly:

## 1. Determine the version

- If a version was provided as an argument, use it (strip leading "v" if present).
- If no version was provided, read the current version from `perry.toml` and bump the patch number (e.g. 1.0.0 → 1.0.1).

## 2. Update perry.toml

- Set `version = "<new version>"` in perry.toml under `[project]`.
- Increment `build_number` by 1.

## 3. Stage, commit, and push

- Run `git add -A` to stage all changes.
- Run `git diff --cached --stat` to show what will be committed.
- Create a commit with message: `Release v<version>`
- Push to origin.

## 4. Create the GitHub release

- Use `gh release create` to create a new release:
  ```
  gh release create v<version> --title "v<version>" --generate-notes
  ```
- This triggers the `.github/workflows/release.yml` pipeline which publishes to:
  - iOS (TestFlight)
  - tvOS (TestFlight)
  - macOS (App Store)
  - Android (Play Store)
  - Windows (GitHub Release)
  - Linux (GitHub Release)

## 5. Report

- Print the release URL.
- Remind the user they can watch the CI progress with: `gh run watch`
