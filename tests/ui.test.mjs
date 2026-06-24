import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("page includes every agreed calculator input", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const expectedFields = [
    "currentPrincipal",
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
});

test("page includes summary, strategy comparison, and schedule sections", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /id="summary"/);
  assert.match(html, /id="comparison"/);
  assert.match(html, /id="schedule"/);
  assert.match(html, /app\.js/);
  assert.match(html, /styles\.css/);
});
