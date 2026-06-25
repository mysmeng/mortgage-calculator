import {
  calculatePrepaymentScenario,
  formatCurrency,
  formatNumber,
} from "./mortgage.js";

const SAMPLE_INPUT = {
  remainingPeriods: 240,
  monthlyPayment: 6500,
  annualRatePercent: 4.2,
  prepayAfterPeriods: 0,
  prepaymentInputMode: "periods",
  prepaymentAmount: 100000,
  prepaymentPeriods: 6,
  feeAmount: 0,
  strategy: "shorterTerm",
};

const form = document.querySelector("#calculatorForm");
const errorMessage = document.querySelector("#errorMessage");
const summary = document.querySelector("#summary");
const comparisonBody = document.querySelector("#comparison tbody");
const schedule = document.querySelector("#schedule");
const resetSample = document.querySelector("#resetSample");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  render();
});

form.addEventListener("input", () => {
  updatePrepaymentModeFields();
  render();
});

resetSample.addEventListener("click", () => {
  setFormValues(SAMPLE_INPUT);
  render();
});

setFormValues(SAMPLE_INPUT);
updatePrepaymentModeFields();
render();

function render() {
  try {
    const input = readFormValues();
    const result = calculatePrepaymentScenario(input);

    errorMessage.textContent = "";
    renderSummary(result);
    renderComparison(result, input.strategy);
    renderSchedule(result, input.strategy);
  } catch (error) {
    errorMessage.textContent =
      error instanceof Error ? error.message : "输入无法计算。";
  }
}

function readFormValues() {
  const formData = new FormData(form);

  return {
    remainingPeriods: Number(formData.get("remainingPeriods")),
    monthlyPayment: Number(formData.get("monthlyPayment")),
    annualRatePercent: Number(formData.get("annualRatePercent")),
    prepayAfterPeriods: Number(formData.get("prepayAfterPeriods")),
    prepaymentInputMode: String(
      formData.get("prepaymentInputMode") || "amount",
    ),
    prepaymentAmount: Number(formData.get("prepaymentAmount")),
    prepaymentPeriods: readOptionalNumber(formData.get("prepaymentPeriods")),
    feeAmount: Number(formData.get("feeAmount") || 0),
    strategy: String(formData.get("strategy") || "shorterTerm"),
  };
}

function readOptionalNumber(value) {
  const text = String(value ?? "").trim();

  return text === "" ? null : Number(text);
}

function setFormValues(values) {
  for (const [key, value] of Object.entries(values)) {
    const field = form.elements.namedItem(key);

    if (!field) {
      continue;
    }

    if (field instanceof RadioNodeList) {
      field.value = String(value);
    } else {
      field.value = String(value);
    }
  }
}

function renderSummary(result) {
  const items = [
    {
      label: "估算当前剩余本金",
      value: formatCurrency(result.currentPrincipal),
      tone: "primary",
    },
    {
      label:
        result.prepaymentInputMode === "periods"
          ? `本次提前还款本金（${formatNumber(result.prepaymentPeriods)} 期）`
          : "本次提前还款金额",
      value: formatCurrency(result.prepaymentAmount),
      tone: "blue",
    },
    {
      label: "提前还款时点本金",
      value: formatCurrency(result.balanceAtPrepayment),
      tone: "blue",
    },
    {
      label: "提前还款后本金",
      value: formatCurrency(result.balanceAfterPrepayment),
      tone: "primary",
    },
    {
      label: "不提前还剩余利息",
      value: formatCurrency(result.baselineRemainingInterest),
      tone: "amber",
    },
  ];

  summary.innerHTML = items
    .map(
      (item) => `
        <article class="metric ${item.tone}">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </article>
      `,
    )
    .join("");
}

function renderComparison(result, selectedStrategy) {
  const rows = [
    ["shorterTerm", result.shorterTerm],
    ["lowerPayment", result.lowerPayment],
  ];

  comparisonBody.innerHTML = rows
    .map(([key, strategy]) => {
      const selected = key === selectedStrategy;
      const finalPayment =
        key === "shorterTerm" && strategy.finalPayment !== strategy.newMonthlyPayment
          ? `<br><small>最后一期 ${formatCurrency(strategy.finalPayment)}</small>`
          : "";

      return `
        <tr class="${selected ? "selected" : ""}">
          <td>
            ${strategy.label}
            ${selected ? '<span class="badge">当前选择</span>' : ""}
          </td>
          <td>${formatCurrency(strategy.newMonthlyPayment)}${finalPayment}</td>
          <td>${formatNumber(strategy.newRemainingPeriods)} 期</td>
          <td>${formatCurrency(strategy.futureInterest)}</td>
          <td>${formatCurrency(strategy.interestSaved)}</td>
          <td>${formatCurrency(strategy.netSavings)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderSchedule(result, selectedStrategy) {
  const strategy = result[selectedStrategy];
  const prepaymentLabel =
    result.prepaymentInputMode === "periods"
      ? `按 ${formatNumber(result.prepaymentPeriods)} 期本金折算`
      : "一次性冲抵本金";
  const strategyText =
    selectedStrategy === "shorterTerm"
      ? `${formatCurrency(strategy.newMonthlyPayment)} / 月，还 ${formatNumber(
          strategy.newRemainingPeriods,
        )} 期`
      : `${formatCurrency(strategy.newMonthlyPayment)} / 月，还 ${formatNumber(
          strategy.newRemainingPeriods,
        )} 期`;

  const rows = [
    [
      "第 0 期",
      "按月供、期数和利率反推的本金",
      formatCurrency(result.currentPrincipal),
    ],
    [
      `第 ${formatNumber(result.prepayAfterPeriods)} 期后`,
      "正常还款后的剩余本金",
      formatCurrency(result.balanceAtPrepayment),
    ],
    ["提前还款", prepaymentLabel, formatCurrency(result.prepaymentAmount)],
    [
      "重算方案",
      result[selectedStrategy].label,
      strategyText,
    ],
    ["净节省", "节省利息扣除手续费/违约金", formatCurrency(strategy.netSavings)],
  ];

  schedule.innerHTML = `
    <h3>关键时间线</h3>
    <dl class="timeline">
      ${rows
        .map(
          ([term, label, value]) => `
            <div class="timeline-row">
              <dt>${term}</dt>
              <dd>${label}</dd>
              <strong>${value}</strong>
            </div>
          `,
        )
        .join("")}
    </dl>
  `;
}

function updatePrepaymentModeFields() {
  const formData = new FormData(form);
  const mode = String(formData.get("prepaymentInputMode") || "amount");

  document.querySelectorAll("[data-mode-panel]").forEach((panel) => {
    panel.classList.toggle(
      "mode-panel-hidden",
      panel.dataset.modePanel !== mode,
    );
  });
}
