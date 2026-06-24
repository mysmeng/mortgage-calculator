# Mortgage Prepayment Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free frontend calculator for fixed-rate equal-payment mortgage prepayment scenarios.

**Architecture:** Keep the amortization math in a small ES module so it can be tested with Node. The HTML page imports the same module, validates user inputs, calculates both prepayment strategies, and renders a comparison table.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, Node built-in test runner.

---

### Task 1: Calculator Core

**Files:**
- Create: `mortgage.js`
- Test: `tests/mortgage.test.mjs`

- [ ] **Step 1: Write failing tests**

Create tests that cover current principal inference, prepayment after several normal payments, reduced-payment strategy, shortened-term strategy, and invalid inputs.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mortgage.test.mjs`
Expected: FAIL because `mortgage.js` does not exist yet.

- [ ] **Step 3: Implement core calculations**

Implement `calculatePrepaymentScenario(input)` and export formatting helpers used by the UI.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/mortgage.test.mjs`
Expected: PASS.

### Task 2: Static Frontend

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js`

- [ ] **Step 1: Build the form**

Inputs: remaining periods, current monthly payment, annual interest rate, prepay after N periods, prepayment amount, fee, and strategy selection.

- [ ] **Step 2: Render results**

Show inferred current principal, balance at prepayment, balance after prepayment, baseline remaining interest, new monthly payment, new remaining periods, saved interest, and net savings.

- [ ] **Step 3: Add validation and sample defaults**

Reject impossible inputs, explain errors inline, and provide realistic defaults for fast trial.

### Task 3: Verification

**Files:**
- Verify: `tests/mortgage.test.mjs`
- Verify: `index.html`
- Verify: `app.js`

- [ ] **Step 1: Run automated tests**

Run: `node --test tests/mortgage.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run module syntax check**

Run: `node --check app.js`
Expected: no syntax errors.

- [ ] **Step 3: Confirm requirements**

Check the page includes every agreed parameter and both output strategies.
