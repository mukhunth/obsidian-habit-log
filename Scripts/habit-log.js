// =============================================================================
// 1. LOAD CONFIGURATION
// =============================================================================
const DateTime = dv.luxon.DateTime;
const today = DateTime.now().startOf("day");

// Attempt to load global defaults from LogIndex.md
let globalConfig = {};
try {
  const configPath = input.configPath || "LogIndex.md";
  const file = app.vault.getAbstractFileByPath(configPath);
  if (file) {
    const content = await app.vault.read(file);
    const match = content.match(/```json\r?\n([\s\S]*?)\r?\n```/);
    if (match) {
      globalConfig = JSON.parse(match[1]);
    }
  }
} catch (e) {
  console.warn("Could not load global habit config.", e);
}

// =============================================================================
// 2. UTILITIES
// =============================================================================
async function openOrMakeNote(dt, folderStr, fileObj, e) {
  let path = fileObj ? fileObj.path : "";
  const dateKey = dt.toFormat("yyyy-MM-dd");

  if (!path) {
    let targetFolder = folderStr;
    // Fallback to core Daily Notes plugin folder if custom folder isn't set
    const dailyNotesPlugin = app.internalPlugins.getPluginById("daily-notes");

    if (
      !targetFolder &&
      dailyNotesPlugin &&
      dailyNotesPlugin.instance.options.folder
    ) {
      targetFolder = dailyNotesPlugin.instance.options.folder;
    }

    path = targetFolder ? `${targetFolder}/${dateKey}.md` : `${dateKey}.md`;
    const fileExists = app.vault.getAbstractFileByPath(path);

    // Create the note and apply the daily note template if it doesn't exist
    if (!fileExists) {
      let content = "";
      if (dailyNotesPlugin && dailyNotesPlugin.instance.options.template) {
        const templateStr = dailyNotesPlugin.instance.options.template;
        const templateFile = app.metadataCache.getFirstLinkpathDest(
          templateStr,
          "",
        );
        if (templateFile) {
          content = await app.vault.read(templateFile);
        }
      }
      await app.vault.create(path, content);
    }
  }
  app.workspace.openLinkText(path, "", e.ctrlKey || e.metaKey);
}

// =============================================================================
// 3. ROUTER
// =============================================================================
// Default to Individual Tracker if 'property' is provided
if (input.property) {
  renderSingle();
} else if (input.habits) {
  renderCombined();
} else {
  dv.paragraph(
    "⚠️ Please provide either a `property` (for individual view) or `habits` (for combined view).",
  );
}

// =============================================================================
// 4. RENDER SINGLE
// =============================================================================
function renderSingle() {
  const habitGlobal =
    input.property && globalConfig[input.property]
      ? globalConfig[input.property]
      : {};

  // Merge configuration in order: Default < Global < Local
  const CONFIG = Object.assign(
    {
      folder: "",
      endDate: null,
      inverse: false,
      color: "var(--interactive-accent)",
      view: "month",
      showStreakLines: true,
      maxWidth: "100%",
    },
    habitGlobal,
    input,
  );

  if (CONFIG.color === "theme") {
    CONFIG.color = "var(--interactive-accent)";
  }

  // ---------------------------------------------------------------------------
  // Data Engine
  // ---------------------------------------------------------------------------
  if (!CONFIG.startDate) {
    dv.paragraph(
      "⚠️ **Error:** `startDate` is required for the individual habit tracker.",
    );
    return;
  }

  const DateTime = dv.luxon.DateTime;
  const today = DateTime.now().startOf("day");
  const start = DateTime.fromISO(CONFIG.startDate).startOf("day");
  const end = CONFIG.endDate
    ? DateTime.fromISO(CONFIG.endDate).startOf("day")
    : today;
  const trackLimit = end < today ? end : today;

  // Scan entire vault for notes matching the folder criteria
  const pages = dv
    .pages()
    .where(
      (p) =>
        p.file.day && (!CONFIG.folder || p.file.folder.includes(CONFIG.folder)),
    );

  // Map out successes and failures for instantaneous lookup
  const noteMap = new Map();

  for (let p of pages) {
    const dateKey = p.file.day.toFormat("yyyy-MM-dd");
    let isTriggered = false;

    const rawVal = p[CONFIG.property];
    if (
      rawVal === true ||
      String(rawVal).toLowerCase() === "true" ||
      (typeof rawVal === "number" && rawVal > 0)
    ) {
      isTriggered = true;
    }

    noteMap.set(dateKey, { triggered: isTriggered, file: p.file });
  }

  // Determine visual state (Future, Tracked, Pending, Untracked)
  function getDayState(dt) {
    const dateKey = dt.toFormat("yyyy-MM-dd");

    if (dt < start || dt > end) return { type: "UNTRACKED", success: false };
    if (dt > today) return { type: "FUTURE", success: false };

    const record = noteMap.get(dateKey);
    const isTriggered = record ? record.triggered : false;

    // Calculate everything till yesterday unless today has a positive entry
    if (dt.hasSame(today, "day") && !isTriggered) {
      return {
        type: "PENDING",
        success: false,
        file: record ? record.file : null,
      };
    }

    const isSuccess = CONFIG.inverse ? !isTriggered : isTriggered;

    return {
      type: "TRACKED",
      success: isSuccess,
      file: record ? record.file : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------
  // Variables for tracking stats
  let longestStreak = 0;
  let longestBreak = 0;
  let totalSuccess = 0;
  let totalTrackedDays = 0;

  let tempStreak = 0;
  let tempBreak = 0;

  let cursor = start;

  // Single-pass loop to calculate streaks and percentages
  while (cursor <= trackLimit) {
    const state = getDayState(cursor);

    if (state.type === "TRACKED") {
      totalTrackedDays++;

      if (state.success) {
        totalSuccess++;
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;

        if (tempBreak > longestBreak) longestBreak = tempBreak;
        tempBreak = 0;
      } else {
        tempBreak++;
        tempStreak = 0;
      }
    }
    cursor = cursor.plus({ days: 1 });
  }
  if (tempBreak > longestBreak) longestBreak = tempBreak;

  const currentStreak = tempStreak;
  const completionPct =
    totalTrackedDays > 0
      ? Math.round((totalSuccess / totalTrackedDays) * 100)
      : 0;

  // ---------------------------------------------------------------------------
  // UI Renderer & CSS
  // ---------------------------------------------------------------------------
  let activeDate = CONFIG.endDate
    ? DateTime.fromISO(CONFIG.endDate).startOf("day")
    : today;

  // Inject the main wrapper and assign CSS variables
  const container = dv.el("div", "", { cls: "wrapper" });

  container.style.setProperty("--color", CONFIG.color);
  container.style.setProperty("--max-width", CONFIG.maxWidth);

  container.innerHTML = `
<div class="top-row">
  <div class="header">${CONFIG.title}</div>
</div>

<div class="nav-row">
  <button class="btn" id="btn-prev">&larr; Prev</button>
  <div class="nav-title" id="date-title"></div>
  <button class="btn" id="btn-next">Next &rarr;</button>
</div>

<div id="main-view"></div>

<div class="stats-panel">
  <div class="stat"><div class="stat-val val-current">${currentStreak}</div><div class="stat-lbl">Current Streak</div></div>
  <div class="stat"><div class="stat-val val-longest">${longestStreak}</div><div class="stat-lbl">Longest Streak</div></div>
  <div class="stat"><div class="stat-val val-break">${longestBreak}</div><div class="stat-lbl">Longest Break</div></div>
  <div class="stat"><div class="stat-val val-white">${completionPct}%</div><div class="stat-lbl">Completion Percentage</div></div>
  <div class="stat"><div class="stat-val val-white">${totalTrackedDays}</div><div class="stat-lbl">Total Tracked Days</div></div>
</div>
`;

  // ---------------------------------------------------------------------------
  // Rendering Logic
  // ---------------------------------------------------------------------------
  const mainView = container.querySelector("#main-view");
  const titleEl = container.querySelector("#date-title");
  const btnPrev = container.querySelector("#btn-prev");
  const btnNext = container.querySelector("#btn-next");

  function buildGrid(targetDt) {
    // Create the calendar grid
    const grid = document.createElement("div");
    grid.className = "grid";

    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((h) => {
      const header = document.createElement("div");
      header.className = "col-header";
      header.textContent = h;
      grid.appendChild(header);
    });

    const startOfMonth = targetDt.startOf("month");
    const endOfMonth = targetDt.endOf("month");
    // Calculate offset for the first day of the month
    let startOffset = startOfMonth.weekday - 1;
    let daysInMonth = endOfMonth.day;

    let cells = [];

    for (let i = startOffset; i > 0; i--) {
      const d = startOfMonth.minus({ days: i });
      cells.push({ dt: d, isCurrentMonth: false, state: getDayState(d) });
    }
    for (let i = 0; i < daysInMonth; i++) {
      const d = startOfMonth.plus({ days: i });
      cells.push({ dt: d, isCurrentMonth: true, state: getDayState(d) });
    }

    let remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = endOfMonth.plus({ days: i });
      cells.push({ dt: d, isCurrentMonth: false, state: getDayState(d) });
    }

    for (let i = 0; i < cells.length; i++) {
      const cellData = cells[i];
      const cellDiv = document.createElement("div");
      cellDiv.className = "cell";

      const circle = document.createElement("div");
      circle.className = "circle";
      circle.textContent = cellData.dt.day;

      if (cellData.state.type === "UNTRACKED")
        cellDiv.classList.add("is-untracked");
      else if (cellData.state.type === "FUTURE")
        cellDiv.classList.add("is-future");
      else if (cellData.state.type === "PENDING")
        cellDiv.classList.add("is-pending");
      else if (cellData.state.success) cellDiv.classList.add("is-success");
      else cellDiv.classList.add("is-fail");

      if (cellData.dt.hasSame(today, "day")) cellDiv.classList.add("is-today");
      if (!cellData.isCurrentMonth) cellDiv.style.opacity = "0.3";

      if (
        CONFIG.showStreakLines &&
        cellData.state.success &&
        cellData.state.type === "TRACKED"
      ) {
        const prev = cells[i - 1];
        const next = cells[i + 1];

        if (
          i % 7 !== 0 &&
          prev &&
          prev.state.success &&
          prev.state.type === "TRACKED"
        ) {
          cellDiv.classList.add("streak-left");
        }
        if (
          i % 7 !== 6 &&
          next &&
          next.state.success &&
          next.state.type === "TRACKED"
        ) {
          cellDiv.classList.add("streak-right");
        }
      }

      // Open note on click
      cellDiv.onclick = (e) =>
        openOrMakeNote(cellData.dt, CONFIG.folder, cellData.state.file, e);

      cellDiv.appendChild(circle);
      grid.appendChild(cellDiv);
    }
    return grid;
  }

  function buildHeatmap(year) {
    const wrapper = document.createElement("div");
    wrapper.className = "heatmap-wrapper";

    const scrollArea = document.createElement("div");
    scrollArea.className = "heatmap-scroll";

    const monthsRow = document.createElement("div");
    monthsRow.className = "heatmap-months";

    const bodyRow = document.createElement("div");
    bodyRow.className = "heatmap-body";

    const daysCol = document.createElement("div");
    daysCol.className = "heatmap-days";
    ["Mon", "", "Wed", "", "Fri", "", "Sun"].forEach((d) => {
      let el = document.createElement("div");
      el.className = "heatmap-day-lbl";
      el.textContent = d;
      daysCol.appendChild(el);
    });

    // Create the calendar grid
    const grid = document.createElement("div");
    grid.className = "heatmap-grid";

    const startOfYear = DateTime.local(year, 1, 1);
    const endOfYear = DateTime.local(year, 12, 31);
    let startOffset = startOfYear.weekday - 1;

    let colIndex = 0;
    let lastMonth = -1;

    for (let i = 0; i < startOffset; i++) {
      const empty = document.createElement("div");
      empty.className = "heatmap-cell empty";
      grid.appendChild(empty);
    }

    let cur = startOfYear;
    while (cur <= endOfYear) {
      if (cur.month !== lastMonth && cur.day <= 7) {
        const monthLbl = document.createElement("div");
        monthLbl.className = "heatmap-month-lbl";
        monthLbl.textContent = cur.toFormat("MMM");
        monthLbl.style.left = `${colIndex * 18}px`;
        monthsRow.appendChild(monthLbl);
        lastMonth = cur.month;
      }

      const state = getDayState(cur);
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";

      if (state.type === "UNTRACKED") cell.classList.add("is-untracked");
      else if (state.type === "FUTURE") cell.classList.add("is-future");
      else if (state.type === "PENDING") cell.classList.add("is-pending");
      else if (state.success) cell.classList.add("is-success");
      else cell.classList.add("is-fail");

      if (cur.hasSame(today, "day")) cell.classList.add("is-today");

      const stateLabel =
        state.type === "PENDING"
          ? "Pending"
          : state.success
            ? "Success"
            : state.type === "UNTRACKED"
              ? "Untracked"
              : "Failed";
      cell.title = `${cur.toFormat("yyyy-MM-dd")}: ${stateLabel}`;

      const cellDate = cur;

      // Open note on click
      cell.onclick = (e) =>
        openOrMakeNote(cellDate, CONFIG.folder, state.file, e);

      grid.appendChild(cell);

      if (cur.weekday === 7) colIndex++;
      cur = cur.plus({ days: 1 });
    }

    bodyRow.appendChild(daysCol);
    bodyRow.appendChild(grid);

    scrollArea.appendChild(monthsRow);
    scrollArea.appendChild(bodyRow);
    wrapper.appendChild(scrollArea);

    return wrapper;
  }

  function render() {
    mainView.innerHTML = "";

    if (CONFIG.view === "month") {
      titleEl.textContent = activeDate.toFormat("MMMM yyyy");
      mainView.appendChild(buildGrid(activeDate));
    } else if (CONFIG.view === "year") {
      titleEl.textContent = activeDate.year;
      const yearContainer = document.createElement("div");
      yearContainer.className = "year-container";

      for (let m = 1; m <= 12; m++) {
        const mDt = DateTime.local(activeDate.year, m, 1);
        const monthBox = document.createElement("div");
        monthBox.className = "mini-month";

        const mTitle = document.createElement("div");
        mTitle.className = "mini-title";
        mTitle.textContent = mDt.toFormat("MMMM");

        monthBox.appendChild(mTitle);
        monthBox.appendChild(buildGrid(mDt));
        yearContainer.appendChild(monthBox);
      }
      mainView.appendChild(yearContainer);
    } else if (CONFIG.view === "heatmap") {
      titleEl.textContent = activeDate.year;
      mainView.appendChild(buildHeatmap(activeDate.year));
    } else {
      mainView.innerHTML = `<div>⚠️ Invalid view: <b>${CONFIG.view}</b>. Allowed values are 'month', 'year', or 'heatmap'.</div>`;
    }
  }

  btnPrev.onclick = () => {
    activeDate =
      CONFIG.view === "month"
        ? activeDate.minus({ months: 1 })
        : activeDate.minus({ years: 1 });
    render();
  };
  btnNext.onclick = () => {
    activeDate =
      CONFIG.view === "month"
        ? activeDate.plus({ months: 1 })
        : activeDate.plus({ years: 1 });
    render();
  };

  render();
}

// =============================================================================
// 5. RENDER COMBINED
// =============================================================================
function renderCombined() {
  // Merge configuration in order: Default < Global < Local
  const CONFIG = Object.assign(
    {
      folder: "",
      month: today.toFormat("yyyy-MM"),
      habits: [],
      defaultColor: "var(--interactive-accent)",
    },
    input,
  );

  if (input.defaultColor === "theme") {
    input.defaultColor = "var(--interactive-accent)";
  }
  const uniformColorOverride = input.defaultColor;

  // Resolve global settings for each habit in the array
  const resolvedHabits = CONFIG.habits.map((h) => {
    let local = typeof h === "string" ? { property: h } : h;
    let global = globalConfig[local.property] || {};
    let merged = Object.assign({}, global, local);
    if (merged.color === "theme") merged.color = "var(--interactive-accent)";
    return merged;
  });

  if (
    !resolvedHabits ||
    !Array.isArray(resolvedHabits) ||
    resolvedHabits.length === 0
  ) {
    dv.paragraph("⚠️ No habits configured for combined view.");
    return;
  }

  const targetMonth = DateTime.fromISO(CONFIG.month + "-01").startOf("month");
  const daysInMonth = targetMonth.daysInMonth;

  // ---------------------------------------------------------------------------
  // Data Engine
  // ---------------------------------------------------------------------------
  // Scan entire vault for notes matching the folder criteria
  const pages = dv.pages().where(
    (p) =>
      p.file.day &&
      (!CONFIG.folder || p.file.folder.includes(CONFIG.folder)) &&
      // Strictly filter for notes within the target month
      p.file.day.year === targetMonth.year &&
      p.file.day.month === targetMonth.month,
  );

  // Map out successes and failures for instantaneous lookup
  const noteMap = new Map();
  for (let p of pages) {
    noteMap.set(p.file.day.toFormat("yyyy-MM-dd"), p);
  }

  // ---------------------------------------------------------------------------
  // UI Renderer & CSS
  // ---------------------------------------------------------------------------
  const container = dv.el("div", "", { cls: "combined-habits-wrapper" });
  container.style.setProperty("--days-in-month", daysInMonth);

  const headerEl = document.createElement("div");
  headerEl.className = "ch-header";
  headerEl.textContent = targetMonth.toFormat("MMMM yyyy");
  container.appendChild(headerEl);

  const gridEl = document.createElement("div");
  gridEl.className = "ch-grid";

  // Top-left empty cell
  const topLeft = document.createElement("div");
  topLeft.style.borderBottom = "1px solid var(--background-modifier-border)";
  topLeft.style.borderRight = "1px solid var(--background-modifier-border)";
  gridEl.appendChild(topLeft);

  // Column headers (Days)
  for (let i = 1; i <= daysInMonth; i++) {
    const colHeader = document.createElement("div");
    colHeader.className = "ch-col-header";
    colHeader.textContent = i;
    if (i === daysInMonth) colHeader.style.borderRight = "none";
    gridEl.appendChild(colHeader);
  }

  // Habit rows
  resolvedHabits.forEach((habit, hIndex) => {
    const rowHeader = document.createElement("div");
    rowHeader.className = "ch-row-header";
    rowHeader.textContent = habit.title || habit.property;
    const isLastRow = hIndex === resolvedHabits.length - 1;
    if (isLastRow) rowHeader.style.borderBottom = "none";
    gridEl.appendChild(rowHeader);

    const hColor =
      uniformColorOverride || habit.color || "var(--interactive-accent)";

    for (let i = 1; i <= daysInMonth; i++) {
      const d = targetMonth.set({ day: i });
      const dateKey = d.toFormat("yyyy-MM-dd");

      let isTriggered = false;
      const page = noteMap.get(dateKey);

      if (page) {
        const rawVal = page[habit.property];
        if (
          rawVal === true ||
          String(rawVal).toLowerCase() === "true" ||
          (typeof rawVal === "number" && rawVal > 0)
        ) {
          isTriggered = true;
        }
      }

      let isSuccess = habit.inverse ? !isTriggered : isTriggered;

      const cellWrapper = document.createElement("div");
      cellWrapper.className = "ch-cell-wrapper";
      if (i === daysInMonth) cellWrapper.style.borderRight = "none";
      if (isLastRow) cellWrapper.style.borderBottom = "none";

      const circle = document.createElement("div");
      circle.className = "ch-circle";
      circle.title = `${dateKey}: ${habit.title || habit.property}`;

      const habitStart = habit.startDate
        ? DateTime.fromISO(habit.startDate).startOf("day")
        : null;
      const isBeforeStart = habitStart && d < habitStart;

      if (d > today || isBeforeStart) {
        circle.classList.add("is-future");
      } else {
        if (isSuccess) {
          circle.classList.add("is-success");
          circle.style.backgroundColor = hColor;
        } else {
          circle.classList.add("is-fail");
        }
        circle.onclick = (e) =>
          openOrMakeNote(d, CONFIG.folder, page ? page.file : null, e);
      }

      if (d.hasSame(today, "day")) {
        circle.classList.add("is-today");
      }

      cellWrapper.appendChild(circle);
      gridEl.appendChild(cellWrapper);
    }
  });

  container.appendChild(gridEl);
}
