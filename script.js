const SHEET_NAME = "main_dash";
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
