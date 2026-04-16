const SHEET_NAME = "main_dash";

const el = {
  apiKey: document.getElementById("apiKey"),
  spreadsheetId: document.getElementById("spreadsheetId"),
  sheetRange: document.getElementById("sheetRange"),
  loadBtn: document.getElementById("loadBtn"),
  demoBtn: document.getElementById("demoBtn"),
  status: document.getElementById("status"),
  dashboardTitle: document.getElementById("dashboardTitle"),
  summaryCards: document.getElementById("summaryCards"),
  categoryBreakdown: document.getElementById("categoryBreakdown"),
  tableWrap: document.getElementById("tableWrap"),
  rowCount: document.getElementById("rowCount"),
  categoryCount: document.getElementById("categoryCount")
};

const demoValues = [
  ["Category", "Type", "Amount", "Budget", "Actual", "Remaining"],
  ["Housing", "Expense", "1200", "1200", "1185", "15"],
  ["Groceries", "Expense", "450", "500", "472", "28"],
  ["Transport", "Expense", "180", "220", "195", "25"],
  ["Utilities", "Expense", "210", "240", "226", "14"],
  ["Dining", "Expense", "160", "180", "205", "-25"],
  ["Salary", "Income", "4200", "4200", "4200", "0"],
  ["Freelance", "Income", "600", "500", "640", "140"]
];

el.loadBtn.addEventListener("click", loadFromGoogleSheets);
el.demoBtn.addEventListener("click", () => renderDashboard(demoValues, "Demo Data"));

function setStatus(message, isError = false) {
  el.status.textContent = message;
  el.status.style.color = isError ? "#b42318" : "#667085";
  el.status.style.borderColor = isError ? "rgba(180,35,24,0.25)" : "#e4e7ec";
}

async function loadFromGoogleSheets() {
  const apiKey = el.apiKey.value.trim();
  const spreadsheetId = el.spreadsheetId.value.trim();
  const inputRange = el.sheetRange.value.trim();

  if (!apiKey || !spreadsheetId || !inputRange) {
    setStatus("Add your API key, spreadsheet ID, and range.", true);
    return;
  }

  const range = `${SHEET_NAME}!${inputRange}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(apiKey)}`;

  try {
    setStatus("Loading sheet data...");
    el.loadBtn.disabled = true;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Sheets API returned ${response.status}`);
    }

    const data = await response.json();
    const values = data.values || [];

    if (!values.length) {
      throw new Error("No rows were returned for that range.");
    }

    renderDashboard(values, `${SHEET_NAME}!${inputRange}`);
    setStatus("Dashboard updated.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Failed to load sheet data.", true);
  } finally {
    el.loadBtn.disabled = false;
  }
}

function renderDashboard(values, title) {
  const { headers, rows } = normalizeSheetData(values);
  const analysis = analyzeBudgetData(headers, rows);

  el.dashboardTitle.textContent = title;
  renderSummaryCards(analysis);
  renderCategoryBreakdown(analysis.categoryTotals);
  renderTable(headers, rows);

  el.rowCount.textContent = `${rows.length} row${rows.length === 1 ? "" : "s"}`;
  el.categoryCount.textContent = `${analysis.categoryTotals.length} categor${analysis.categoryTotals.length === 1 ? "y" : "ies"}`;
}

function normalizeSheetData(values) {
  const [rawHeaders, ...rawRows] = values;
  const headers = rawHeaders.map((header, index) => {
    const clean = String(header || "").trim();
    return clean || `Column ${index + 1}`;
  });

  const rows = rawRows
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row) => {
      const completeRow = [...row];
      while (completeRow.length < headers.length) completeRow.push("");
      return completeRow.map((cell) => String(cell ?? "").trim());
    });

  return { headers, rows };
}

function analyzeBudgetData(headers, rows) {
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  const amountIndex = findHeaderIndex(lowerHeaders, ["amount", "value", "total"]);
  const actualIndex = findHeaderIndex(lowerHeaders, ["actual", "spent", "expense", "used"]);
  const budgetIndex = findHeaderIndex(lowerHeaders, ["budget", "planned", "target"]);
  const remainingIndex = findHeaderIndex(lowerHeaders, ["remaining", "left", "difference", "variance"]);
  const categoryIndex = findHeaderIndex(lowerHeaders, ["category", "group", "bucket", "name"]);
  const typeIndex = findHeaderIndex(lowerHeaders, ["type", "kind"]);

  let income = 0;
  let expenses = 0;
  let budgetTotal = 0;
  let actualTotal = 0;
  let remainingTotal = 0;

  const categoryMap = new Map();

  rows.forEach((row) => {
    const amount = getNumericCell(row, amountIndex);
    const actual = getNumericCell(row, actualIndex);
    const budget = getNumericCell(row, budgetIndex);
    const remaining = getNumericCell(row, remainingIndex);
    const type = typeIndex >= 0 ? String(row[typeIndex] || "").toLowerCase() : "";
    const category = categoryIndex >= 0 ? row[categoryIndex] || "Uncategorized" : `Row ${categoryMap.size + 1}`;

    if (budget !== null) budgetTotal += budget;
    if (actual !== null) actualTotal += actual;
    if (remaining !== null) remainingTotal += remaining;

    const valueForGrouping = actual ?? amount ?? budget ?? remaining ?? 0;

    if (type.includes("income") || valueForGrouping > 0 && category.toLowerCase().includes("salary")) {
      income += valueForGrouping;
    } else if (type.includes("expense")) {
      expenses += Math.abs(valueForGrouping);
    } else {
      if (valueForGrouping >= 0) {
        income += valueForGrouping;
      } else {
        expenses += Math.abs(valueForGrouping);
      }
    }

    const existing = categoryMap.get(category) || 0;
    categoryMap.set(category, existing + Math.abs(valueForGrouping));
  });

  const derivedRemaining = remainingTotal || (budgetTotal && actualTotal ? budgetTotal - actualTotal : income - expenses);
  const net = income - expenses;

  const categoryTotals = Array.from(categoryMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return {
    income,
    expenses,
    net,
    budgetTotal,
    actualTotal,
    remainingTotal: derivedRemaining,
    categoryTotals
  };
}

function findHeaderIndex(headers, keywords) {
  return headers.findIndex((header) => keywords.some((keyword) => header.includes(keyword)));
}

function getNumericCell(row, index) {
  if (index < 0 || index >= row.length) return null;
  return toNumber(row[index]);
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[$,%\s,]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function renderSummaryCards(analysis) {
  const cards = [
    {
      label: "Total Income",
      value: formatCurrency(analysis.income),
      note: "Based on rows interpreted as income",
      className: "good"
    },
    {
      label: "Total Expenses",
      value: formatCurrency(analysis.expenses),
      note: "Based on rows interpreted as expenses",
      className: "bad"
    },
    {
      label: "Net",
      value: formatCurrency(analysis.net),
      note: analysis.net >= 0 ? "Positive cash flow" : "Negative cash flow",
      className: analysis.net >= 0 ? "good" : "bad"
    },
    {
      label: "Remaining",
      value: formatCurrency(analysis.remainingTotal),
      note: "Uses Remaining column when available",
      className: analysis.remainingTotal >= 0 ? "good" : "bad"
    }
  ];

  el.summaryCards.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <div class="label">${escapeHtml(card.label)}</div>
          <div class="value ${card.className}">${escapeHtml(card.value)}</div>
          <div class="note">${escapeHtml(card.note)}</div>
        </article>
      `
    )
    .join("");
}

function renderCategoryBreakdown(categoryTotals) {
  if (!categoryTotals.length) {
    el.categoryBreakdown.className = "breakdown-list empty-state";
    el.categoryBreakdown.textContent = "No category-style data detected.";
    return;
  }

  el.categoryBreakdown.className = "breakdown-list";
  const maxValue = categoryTotals[0].total || 1;

  el.categoryBreakdown.innerHTML = categoryTotals
    .map((item) => {
      const pct = Math.max(6, Math.round((item.total / maxValue) * 100));
      return `
        <div class="breakdown-item">
          <div class="breakdown-top">
            <span>${escapeHtml(item.name)}</span>
            <span>${escapeHtml(formatCurrency(item.total))}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTable(headers, rows) {
  if (!rows.length) {
    el.tableWrap.className = "table-wrap empty-state";
    el.tableWrap.textContent = "The selected range only contains headers.";
    return;
  }

  el.tableWrap.className = "table-wrap";
  const headHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const bodyHtml = rows
    .map(
      (row) => `
        <tr>
          ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
        </tr>
      `
    )
    .join("");

  el.tableWrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>${headHtml}</tr>
      </thead>
      <tbody>
        ${bodyHtml}
      </tbody>
    </table>
  `;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
