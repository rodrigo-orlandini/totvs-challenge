# Test-Driven Development

---
name: tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests.
---

## Overview

TDD follows the red → green loop, emphasizing tests that remain valuable through refactors. The skill provides guidance on test quality, where tests belong in the codebase, common pitfalls, and the mechanics of the cycle itself.

## Key Principles

**Good tests verify behavior through public interfaces.** Tests should read like specifications and survive code changes because they don't depend on implementation details. Before writing tests, confirm the seams (public boundaries) you'll test against with stakeholders.

**Avoid three anti-patterns:**

1. *Implementation-coupled* tests that mock internals or verify through side channels
2. *Tautological* tests where assertions recompute expected values the same way the code does
3. *Horizontal slicing*, writing all tests before implementation; use vertical slices instead

**The loop has three rules:**

- Write failing tests first, then minimal code to pass them
- Work one slice at a time—one seam, test, and implementation per cycle
- Reserve refactoring for code review, not the red-green phase

Before starting, consult `CONTEXT.md` and project ADRs to align test vocabulary with domain language.
