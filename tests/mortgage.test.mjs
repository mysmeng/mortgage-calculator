import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePrepaymentScenario,
  formatCurrency,
  formatPercent,
} from "../mortgage.js";

test("infers current principal from fixed monthly payment and remaining terms", () => {
  const result = calculatePrepaymentScenario({
    remainingPeriods: 240,
    monthlyPayment: 6500,
    annualRatePercent: 4.2,
    prepayAfterPeriods: 0,
    prepaymentAmount: 100000,
    feeAmount: 0,
  });

  assert.equal(Math.round(result.currentPrincipal), 1054218);
  assert.equal(Math.round(result.baselineRemainingInterest), 505782);
});

test("uses provided current principal before falling back to inferred principal", () => {
  const result = calculatePrepaymentScenario({
    currentPrincipal: 1000000,
    remainingPeriods: 240,
    monthlyPayment: 6500,
    annualRatePercent: 4.2,
    prepayAfterPeriods: 0,
    prepaymentAmount: 100000,
    feeAmount: 0,
  });

  assert.equal(result.currentPrincipal, 1000000);
  assert.equal(Math.round(result.baselineRemainingInterest), 560000);
  assert.equal(result.balanceAtPrepayment, 1000000);
  assert.equal(result.balanceAfterPrepayment, 900000);
});

test("applies prepayment after normal payments before recalculating strategies", () => {
  const result = calculatePrepaymentScenario({
    remainingPeriods: 240,
    monthlyPayment: 6500,
    annualRatePercent: 4.2,
    prepayAfterPeriods: 12,
    prepaymentAmount: 100000,
    feeAmount: 0,
  });

  assert.equal(result.prepayAfterPeriods, 12);
  assert.equal(result.periodsLeftAtPrepayment, 228);
  assert.equal(Math.round(result.balanceAtPrepayment), 1019838);
  assert.equal(Math.round(result.balanceAfterPrepayment), 919838);
});

test("calculates prepayment amount from scheduled principal periods", () => {
  const result = calculatePrepaymentScenario({
    remainingPeriods: 240,
    monthlyPayment: 6500,
    annualRatePercent: 4.2,
    prepayAfterPeriods: 0,
    prepaymentInputMode: "periods",
    prepaymentPeriods: 6,
    prepaymentAmount: 100000,
    feeAmount: 0,
  });

  assert.equal(result.prepaymentInputMode, "periods");
  assert.equal(result.prepaymentPeriods, 6);
  assert.equal(result.prepaymentAmount, 17009.65);
  assert.equal(Math.round(result.balanceAfterPrepayment), 1037208);
});

test("matches principal-only amount for 60-period prepayment from screenshot scenario", () => {
  const result = calculatePrepaymentScenario({
    currentPrincipal: 560327.2,
    remainingPeriods: 295,
    monthlyPayment: 2745.88,
    annualRatePercent: 3.2,
    prepayAfterPeriods: 0,
    prepaymentInputMode: "periods",
    prepaymentPeriods: 60,
    prepaymentAmount: 1,
    feeAmount: 0,
  });

  assert.equal(result.prepaymentAmount, 81324.86);
  assert.equal(result.balanceAfterPrepayment, 479002.34);
});

test("compares lower-payment and shorter-term prepayment strategies", () => {
  const result = calculatePrepaymentScenario({
    remainingPeriods: 240,
    monthlyPayment: 6500,
    annualRatePercent: 4.2,
    prepayAfterPeriods: 0,
    prepaymentAmount: 100000,
    feeAmount: 500,
  });

  assert.equal(Math.round(result.lowerPayment.newMonthlyPayment), 5883);
  assert.equal(result.lowerPayment.newRemainingPeriods, 240);
  assert.equal(Math.round(result.lowerPayment.interestSaved), 47977);
  assert.equal(Math.round(result.lowerPayment.netSavings), 47477);

  assert.equal(result.shorterTerm.newMonthlyPayment, 6500);
  assert.equal(result.shorterTerm.newRemainingPeriods, 207);
  assert.equal(Math.round(result.shorterTerm.finalPayment), 2633);
  assert.equal(Math.round(result.shorterTerm.interestSaved), 118367);
  assert.equal(Math.round(result.shorterTerm.netSavings), 117867);
});

test("supports zero interest loans", () => {
  const result = calculatePrepaymentScenario({
    remainingPeriods: 24,
    monthlyPayment: 5000,
    annualRatePercent: 0,
    prepayAfterPeriods: 3,
    prepaymentAmount: 20000,
    feeAmount: 0,
  });

  assert.equal(result.currentPrincipal, 120000);
  assert.equal(result.balanceAtPrepayment, 105000);
  assert.equal(result.balanceAfterPrepayment, 85000);
  assert.equal(result.lowerPayment.newMonthlyPayment, 4047.62);
  assert.equal(result.shorterTerm.newRemainingPeriods, 17);
});

test("rejects impossible inputs", () => {
  assert.throws(
    () =>
      calculatePrepaymentScenario({
        remainingPeriods: 10,
        monthlyPayment: 1000,
        annualRatePercent: 3,
        prepayAfterPeriods: 11,
        prepaymentAmount: 1000,
        feeAmount: 0,
      }),
    /不能大于剩余期数/,
  );

  assert.throws(
    () =>
      calculatePrepaymentScenario({
        currentPrincipal: 100000,
        remainingPeriods: 10,
        monthlyPayment: 1000,
        annualRatePercent: 3,
        prepayAfterPeriods: 0,
        prepaymentAmount: 200000,
        feeAmount: 0,
      }),
    /不能超过提前还款时点的剩余本金/,
  );

  assert.throws(
    () =>
      calculatePrepaymentScenario({
        currentPrincipal: -1,
        remainingPeriods: 10,
        monthlyPayment: 1000,
        annualRatePercent: 3,
        prepayAfterPeriods: 0,
        prepaymentAmount: 1000,
        feeAmount: 0,
      }),
    /当前剩余本金必须大于 0/,
  );

  assert.throws(
    () =>
      calculatePrepaymentScenario({
        remainingPeriods: 10,
        monthlyPayment: 1000,
        annualRatePercent: 3,
        prepayAfterPeriods: 0,
        prepaymentInputMode: "periods",
        prepaymentPeriods: 0,
        prepaymentAmount: 1000,
        feeAmount: 0,
      }),
    /提前还款期数必须大于 0/,
  );
});

test("formats display values for the frontend", () => {
  assert.equal(formatCurrency(1234567.891), "¥1,234,567.89");
  assert.equal(formatPercent(4.2), "4.2%");
});
