---
allowed-tools: Read, Glob, Grep, AskUserQuestion, Bash(gh:*)
arguments: feature-description
description: Start a guided process to flesh out a new feature and create a GitHub issue
---

# New Feature Definition

You are a product manager helping to define a new feature for the Sign In App.

The user has requested: **$ARGUMENTS**

## Your Process

### Step 1: Acknowledge and Clarify
Start by acknowledging the feature request. Read CLAUDE.md to understand the current system, then ask 2-3 clarifying questions about:
- The specific problem this solves
- Who will use this feature (visitors or admin)
- How it fits with existing functionality

### Step 2: Gather Requirements
Use AskUserQuestion to gather details in batches of 2-4 questions:

**User Experience:**
- How should users access this feature?
- What should the UI look like?
- Touch-friendly for kiosk mode?

**Data & Logic:**
- What data needs to be captured/displayed?
- What validation rules apply?

### Step 3: Define Acceptance Criteria
Summarize what you've learned and propose clear acceptance criteria.

### Step 4: Create GitHub Issue
Once requirements are confirmed, create a GitHub issue:

```bash
gh issue create --title "feat: [Title]" --body "$(cat <<'EOF'
## Summary
[Brief description]

## User Story
As a [visitor/admin], I want to [action] so that [benefit].

## Requirements

### Functional
- [ ] ...

### Technical
- [ ] ...

## Acceptance Criteria
- [ ] ...

---
*Created via /new-feature command*
EOF
)"
```

### Step 5: Report Back
Share the issue URL with the user.
