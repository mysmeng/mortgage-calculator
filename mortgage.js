const CURRENCY_FORMATTER = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function calculatePrepaymentScenario(input) {
  const values = normalizeInput(input);
  const monthlyRate = values.annualRatePercent / 100 / 12;
  const inferredPrincipal = calculatePresentValue(
    values.monthlyPayment,
    monthlyRate,
    values.remainingPeriods,
  );
  const currentPrincipal = values.currentPrincipal ?? inferredPrincipal;
  const principalSource =
    values.currentPrincipal === null ? "inferred" : "provided";
  const baselineRemainingInterest =
    values.monthlyPayment * values.remainingPeriods - currentPrincipal;
  const balanceAtPrepayment = amortizeBalance({
    balance: currentPrincipal,
    monthlyPayment: values.monthlyPayment,
    monthlyRate,
    periods: values.prepayAfterPeriods,
  });
  const periodsLeftAtPrepayment =
    values.remainingPeriods - values.prepayAfterPeriods;
  const prepaymentAmount = calculateEffectivePrepaymentAmount({
    values,
    balanceAtPrepayment,
    monthlyRate,
    periodsLeftAtPrepayment,
  });

  if (prepaymentAmount > balanceAtPrepayment + 0.005) {
    throw new RangeError("提前还款金额不能超过提前还款时点的剩余本金。");
  }

  const balanceAfterPrepayment = Math.max(
    0,
    balanceAtPrepayment - prepaymentAmount,
  );
  const interestPaidBeforePrepayment =
    values.monthlyPayment * values.prepayAfterPeriods -
    (currentPrincipal - balanceAtPrepayment);

  const lowerPayment = calculateLowerPaymentStrategy({
    balanceAfterPrepayment,
    periodsLeftAtPrepayment,
    monthlyRate,
    feeAmount: values.feeAmount,
    baselineRemainingInterest,
    interestPaidBeforePrepayment,
  });
  const shorterTerm = calculateShorterTermStrategy({
    balanceAfterPrepayment,
    originalMonthlyPayment: values.monthlyPayment,
    monthlyRate,
    feeAmount: values.feeAmount,
    baselineRemainingInterest,
    interestPaidBeforePrepayment,
  });

  return {
    ...values,
    monthlyRate,
    principalSource,
    inferredPrincipal: roundMoney(inferredPrincipal),
    currentPrincipal: roundMoney(currentPrincipal),
    prepaymentAmount: roundMoney(prepaymentAmount),
    baselineRemainingInterest: roundMoney(baselineRemainingInterest),
    balanceAtPrepayment: roundMoney(balanceAtPrepayment),
    balanceAfterPrepayment: roundMoney(balanceAfterPrepayment),
    periodsLeftAtPrepayment,
    interestPaidBeforePrepayment: roundMoney(interestPaidBeforePrepayment),
    lowerPayment,
    shorterTerm,
  };
}

export function formatCurrency(value) {
  return CURRENCY_FORMATTER.format(value);
}

export function formatNumber(value) {
  return NUMBER_FORMATTER.format(value);
}

export function formatPercent(value) {
  return `${NUMBER_FORMATTER.format(value)}%`;
}

function normalizeInput(input) {
  const monthlyPayment = toFiniteNumber(input.monthlyPayment, "当前月供");
  const prepaymentInputMode = normalizePrepaymentInputMode(
    input.prepaymentInputMode,
  );
  const prepaymentPeriods =
    prepaymentInputMode === "periods"
      ? toFiniteNumber(input.prepaymentPeriods, "提前还款期数")
      : toOptionalPositiveNumber(input.prepaymentPeriods, "提前还款期数");
  const prepaymentAmount =
    prepaymentInputMode === "periods"
      ? toOptionalPositiveNumber(input.prepaymentAmount, "提前还款金额")
      : toFiniteNumber(input.prepaymentAmount, "提前还款金额");

  const values = {
    currentPrincipal: toOptionalPositiveNumber(
      input.currentPrincipal,
      "当前剩余本金",
    ),
    remainingPeriods: toInteger(input.remainingPeriods, "剩余期数"),
    monthlyPayment,
    annualRatePercent: toFiniteNumber(input.annualRatePercent, "当前年利率"),
    prepayAfterPeriods: toInteger(input.prepayAfterPeriods, "第几期后提前还款"),
    prepaymentInputMode,
    prepaymentPeriods,
    prepaymentAmount,
    feeAmount: toFiniteNumber(input.feeAmount ?? 0, "手续费/违约金"),
  };

  if (values.remainingPeriods <= 0) {
    throw new RangeError("剩余期数必须大于 0。");
  }

  if (values.monthlyPayment <= 0) {
    throw new RangeError("当前月供必须大于 0。");
  }

  if (values.annualRatePercent < 0) {
    throw new RangeError("当前年利率不能小于 0。");
  }

  if (values.prepayAfterPeriods < 0) {
    throw new RangeError("第几期后提前还款不能小于 0。");
  }

  if (values.prepayAfterPeriods > values.remainingPeriods) {
    throw new RangeError("第几期后提前还款不能大于剩余期数。");
  }

  if (
    values.prepaymentInputMode === "periods" &&
    values.prepaymentPeriods <= 0
  ) {
    throw new RangeError("提前还款期数必须大于 0。");
  }

  if (
    values.prepaymentInputMode === "amount" &&
    values.prepaymentAmount <= 0
  ) {
    throw new RangeError("提前还款金额必须大于 0。");
  }

  if (values.feeAmount < 0) {
    throw new RangeError("手续费/违约金不能小于 0。");
  }

  return values;
}

function normalizePrepaymentInputMode(value) {
  const mode = value ?? "amount";

  if (mode !== "amount" && mode !== "periods") {
    throw new RangeError("提前还款金额输入方式无效。");
  }

  return mode;
}

function calculateEffectivePrepaymentAmount({
  values,
  balanceAtPrepayment,
  monthlyRate,
  periodsLeftAtPrepayment,
}) {
  if (values.prepaymentInputMode === "amount") {
    return values.prepaymentAmount;
  }

  if (values.prepaymentPeriods > periodsLeftAtPrepayment) {
    throw new RangeError("提前还款期数不能大于提前还款时点剩余期数。");
  }

  const balanceAfterScheduledPeriods = amortizeBalance({
    balance: balanceAtPrepayment,
    monthlyPayment: values.monthlyPayment,
    monthlyRate,
    periods: values.prepaymentPeriods,
  });
  const scheduledPrincipal = balanceAtPrepayment - balanceAfterScheduledPeriods;

  if (scheduledPrincipal <= 0) {
    throw new RangeError("当前月供不足以覆盖每期利息，无法按期数折算本金。");
  }

  return scheduledPrincipal;
}

function calculatePresentValue(payment, monthlyRate, periods) {
  if (monthlyRate === 0) {
    return payment * periods;
  }

  return (payment * (1 - (1 + monthlyRate) ** -periods)) / monthlyRate;
}

function calculateMonthlyPayment(balance, monthlyRate, periods) {
  if (balance === 0 || periods === 0) {
    return 0;
  }

  if (monthlyRate === 0) {
    return balance / periods;
  }

  return (
    (balance * monthlyRate * (1 + monthlyRate) ** periods) /
    ((1 + monthlyRate) ** periods - 1)
  );
}

function calculateTermCount(balance, monthlyPayment, monthlyRate) {
  if (balance === 0) {
    return 0;
  }

  if (monthlyRate === 0) {
    return Math.ceil(balance / monthlyPayment);
  }

  if (monthlyPayment <= balance * monthlyRate) {
    throw new RangeError("当前月供不足以覆盖每期利息，无法缩短期限。");
  }

  const exactPeriods =
    -Math.log(1 - (balance * monthlyRate) / monthlyPayment) /
    Math.log(1 + monthlyRate);

  return Math.ceil(exactPeriods);
}

function amortizeBalance({ balance, monthlyPayment, monthlyRate, periods }) {
  let currentBalance = balance;

  for (let period = 0; period < periods; period += 1) {
    const interest = currentBalance * monthlyRate;
    const principalPaid = monthlyPayment - interest;
    currentBalance = Math.max(0, currentBalance - principalPaid);
  }

  return currentBalance;
}

function calculateLowerPaymentStrategy({
  balanceAfterPrepayment,
  periodsLeftAtPrepayment,
  monthlyRate,
  feeAmount,
  baselineRemainingInterest,
  interestPaidBeforePrepayment,
}) {
  const newMonthlyPayment = calculateMonthlyPayment(
    balanceAfterPrepayment,
    monthlyRate,
    periodsLeftAtPrepayment,
  );
  const futureInterest =
    newMonthlyPayment * periodsLeftAtPrepayment - balanceAfterPrepayment;
  const totalInterest = interestPaidBeforePrepayment + futureInterest;
  const interestSaved = baselineRemainingInterest - totalInterest;

  return {
    label: "期限不变，降低月供",
    newMonthlyPayment: roundMoney(newMonthlyPayment),
    newRemainingPeriods: periodsLeftAtPrepayment,
    futureInterest: roundMoney(futureInterest),
    totalInterest: roundMoney(totalInterest),
    interestSaved: roundMoney(interestSaved),
    netSavings: roundMoney(interestSaved - feeAmount),
  };
}

function calculateShorterTermStrategy({
  balanceAfterPrepayment,
  originalMonthlyPayment,
  monthlyRate,
  feeAmount,
  baselineRemainingInterest,
  interestPaidBeforePrepayment,
}) {
  const newRemainingPeriods = calculateTermCount(
    balanceAfterPrepayment,
    originalMonthlyPayment,
    monthlyRate,
  );
  const payoff = calculatePayoffWithFixedPayment({
    balance: balanceAfterPrepayment,
    monthlyPayment: originalMonthlyPayment,
    monthlyRate,
  });
  const futureInterest = payoff.futureInterest;
  const totalInterest = interestPaidBeforePrepayment + futureInterest;
  const interestSaved = baselineRemainingInterest - totalInterest;

  return {
    label: "月供不变，缩短期限",
    newMonthlyPayment: roundMoney(
      balanceAfterPrepayment === 0 ? 0 : originalMonthlyPayment,
    ),
    newRemainingPeriods,
    finalPayment: roundMoney(payoff.finalPayment),
    futureInterest: roundMoney(futureInterest),
    totalInterest: roundMoney(totalInterest),
    interestSaved: roundMoney(interestSaved),
    netSavings: roundMoney(interestSaved - feeAmount),
  };
}

function calculatePayoffWithFixedPayment({ balance, monthlyPayment, monthlyRate }) {
  let currentBalance = balance;
  let futureInterest = 0;
  let finalPayment = 0;
  let guard = 0;

  while (currentBalance > 0.005) {
    const interest = currentBalance * monthlyRate;
    const payoffAmount = currentBalance + interest;
    const payment = Math.min(monthlyPayment, payoffAmount);

    futureInterest += interest;
    finalPayment = payment;
    currentBalance = Math.max(0, payoffAmount - payment);
    guard += 1;

    if (guard > 1200) {
      throw new RangeError("缩短期限计算超过 1200 期，请检查输入。");
    }
  }

  return {
    futureInterest,
    finalPayment,
  };
}

function toFiniteNumber(value, label) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new TypeError(`${label}必须是有效数字。`);
  }

  return number;
}

function toOptionalPositiveNumber(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = toFiniteNumber(value, label);

  if (number <= 0) {
    throw new RangeError(`${label}必须大于 0。`);
  }

  return number;
}

function toInteger(value, label) {
  const number = toFiniteNumber(value, label);

  if (!Number.isInteger(number)) {
    throw new TypeError(`${label}必须是整数。`);
  }

  return number;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
