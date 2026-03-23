---
name: github-operations
description: Full GitHub workflow for the Lead Developer — git setup, repo creation/cloning, branching, commits, PRs, and gh CLI operations. Run the setup block before any git operation.
allowed-tools: Bash, Read, Write, Edit
---

# GitHub Operations

Full git and GitHub CLI workflow for code implementation tasks. Always run the setup block first.

## Required Setup (run before any git operation)

```bash
git config --global user.email "mnemclaw@proton.me"
git config --global user.name "mnemclaw"
git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
TOKEN=$(echo $GITHUB_TOKEN | tr -d '[:space:]')
```

## Clone a Repo

```bash
git clone https://github.com/mnemclaw/<repo-name>.git
cd <repo-name>
```

Always use HTTPS clone URLs. Never SSH.

## Create a New Repo

```bash
gh repo create mnemclaw/<repo-name> --private --description "<description>" --clone
# Or public:
gh repo create mnemclaw/<repo-name> --public --description "<description>" --clone
```

## Branching

```bash
# Create and switch to feature branch
git checkout -b feat/<feature-name>

# Push branch and set upstream
git push -u origin feat/<feature-name>
```

## Committing

```bash
# Stage all changes
git add -A

# Conventional commit format
git commit -m "feat(<scope>): <short description>"
git commit -m "fix(<scope>): <short description>"
git commit -m "chore: <short description>"
git commit -m "docs: <short description>"
git commit -m "test: <short description>"
```

Commit types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`

## Push

```bash
git push
# First push on new branch:
git push -u origin <branch-name>
```

## Pull Requests

```bash
# Create PR
gh pr create --title "<PR title>" --body "<description>" --base main

# List open PRs
gh pr list

# Merge PR (squash)
gh pr merge <PR-number> --squash --delete-branch
```

## Checking Status

```bash
git status
git log --oneline -10
git diff HEAD
```

## Repo Info

```bash
# View repo details
gh repo view mnemclaw/<repo-name>

# List recent releases
gh release list --repo mnemclaw/<repo-name>

# View open issues
gh issue list --repo mnemclaw/<repo-name>
```

## Tagging and Releases

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Create GitHub release
gh release create v1.0.0 --title "v1.0.0" --notes "<release notes>"
```

## Conflict Resolution

```bash
# Pull latest and rebase
git fetch origin
git rebase origin/main

# If conflicts:
# 1. Edit conflicted files
# 2. git add <resolved-files>
# 3. git rebase --continue
```

## Common Patterns

### Initial project scaffold
```bash
git clone https://github.com/mnemclaw/<repo>.git
cd <repo>
git checkout -b feat/scaffold
# ... create files ...
git add -A
git commit -m "feat: initial project scaffold"
git push -u origin feat/scaffold
gh pr create --title "feat: initial scaffold" --body "Phase 0 scaffold" --base main
```

### After each phase
```bash
git add -A
git commit -m "feat(<phase>): <description>"
git push
```
