import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("page includes every agreed calculator input", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const expectedFields = [
    "remainingPeriods",
    "monthlyPayment",
    "annualRatePercent",
    "prepayAfterPeriods",
    "prepaymentInputMode",
    "prepaymentAmount",
    "prepaymentPeriods",
    "feeAmount",
    "strategy",
  ];

  for (const fieldId of expectedFields) {
    assert.match(html, new RegExp(`id="${fieldId}"`));
  }

  assert.doesNotMatch(html, /id="currentPrincipal"/);
});

test("page includes summary, strategy comparison, and schedule sections", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /id="summary"/);
  assert.match(html, /id="comparison"/);
  assert.match(html, /id="schedule"/);
  assert.match(html, /app\.js/);
  assert.match(html, /styles\.css/);
});

test("page links to the GitHub repository", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /https:\/\/github\.com\/mysmeng\/mortgage-calculator/);
  assert.match(html, /aria-label="打开 GitHub 仓库"/);
  assert.match(html, /class="repo-link"/);
});

test("prepayment mode defaults to scheduled principal periods", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const amountInput = html.match(
    /id="prepaymentModeAmount"[\s\S]*?\/>/,
  )?.[0];
  const periodsInput = html.match(
    /id="prepaymentModePeriods"[\s\S]*?\/>/,
  )?.[0];

  assert.ok(amountInput);
  assert.ok(periodsInput);
  assert.doesNotMatch(amountInput, /checked/);
  assert.match(periodsInput, /checked/);
});
