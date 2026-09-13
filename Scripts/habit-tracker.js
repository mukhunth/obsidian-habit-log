// =============================================================================
// 1. CONFIGURATION (Passed in from dv.view)
// =============================================================================
const CONFIG = Object.assign({
    folder: "",
    trackingEnd: null,
    inverse: false,
    color: "var(--interactive-accent)",
    view: "month",
    showStreakLines: false,
    maxWidth: "100%"
}, input);

// =============================================================================
// 2. DATA ENGINE & HELPER FUNCTIONS
// =============================================================================
const DateTime = dv.luxon.DateTime;
const today = DateTime.now().startOf('day');
const start = DateTime.fromISO(CONFIG.trackingStart).startOf('day');
const end = CONFIG.trackingEnd ? DateTime.fromISO(CONFIG.trackingEnd).startOf('day') : today;
const trackLimit = end < today ? end : today;

const pages = dv.pages().where(p =>
    p.file.day &&
    (!CONFIG.folder || p.file.folder.includes(CONFIG.folder))
);

const noteMap = new Map();

for (let p of pages) {
    const dateKey = p.file.day.toFormat("yyyy-MM-dd");
    let isTriggered = false;

    const rawVal = p[CONFIG.property];
    if (rawVal === true || String(rawVal).toLowerCase() === "true" || (typeof rawVal === "number" && rawVal > 0)) {
        isTriggered = true;
    }

    noteMap.set(dateKey, { triggered: isTriggered, file: p.file });
}

function getDayState(dt) {
    const dateKey = dt.toFormat("yyyy-MM-dd");

    if (dt < start || dt > end) return { type: "UNTRACKED", success: false };
    if (dt > today) return { type: "FUTURE", success: false };

    const record = noteMap.get(dateKey);
    const isTriggered = record ? record.triggered : false;

    // UNIVERSAL PENDING LOGIC: Calculate everything till yesterday unless today has a positive entry
    if (dt.hasSame(today, "day") && !isTriggered) {
        return { type: "PENDING", success: false, file: record ? record.file : null };
    }

    const isSuccess = CONFIG.inverse ? !isTriggered : isTriggered;

    return { type: "TRACKED", success: isSuccess, file: record ? record.file : null };
}

// CENTRALIZED HELPER: Handles file creation and opening for all views
async function openOrMakeNote(dt, fileObj, e) {
    let path = fileObj ? fileObj.path : "";
    const dateKey = dt.toFormat("yyyy-MM-dd");

    if (!path) {
        let targetFolder = CONFIG.folder;
        const dailyNotesPlugin = app.internalPlugins.getPluginById("daily-notes");

        if (!targetFolder && dailyNotesPlugin && dailyNotesPlugin.instance.options.folder) {
            targetFolder = dailyNotesPlugin.instance.options.folder;
        }

        path = targetFolder ? `${targetFolder}/${dateKey}.md` : `${dateKey}.md`;
        const fileExists = app.vault.getAbstractFileByPath(path);

        if (!fileExists) {
            let content = "";
            if (dailyNotesPlugin && dailyNotesPlugin.instance.options.template) {
                const templateStr = dailyNotesPlugin.instance.options.template;
                const templateFile = app.metadataCache.getFirstLinkpathDest(templateStr, "");

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
// 3. STATISTICS MATH (Streamlined Single-Pass)
// =============================================================================
let longestStreak = 0;
let longestBreak = 0;
let totalSuccess = 0;
let totalTrackedDays = 0;

let tempStreak = 0;
let tempBreak = 0;

let cursor = start;

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
const completionPct = totalTrackedDays > 0 ? Math.round((totalSuccess / totalTrackedDays) * 100) : 0;

// =============================================================================
// 4. UI RENDERER & CSS
// =============================================================================
let activeDate = CONFIG.trackingEnd ? DateTime.fromISO(CONFIG.trackingEnd).startOf('day') : today;

const container = dv.el("div", "", { cls: "wrapper" });

container.style.setProperty('--color', CONFIG.color);
container.style.setProperty('--max-width', CONFIG.maxWidth);

container.innerHTML = `
<style>
  .wrapper { font-family: var(--font-interface); margin: 0 auto; transparent: black; padding: 20px; color: var(--text-normal); width: 100%; max-width: var(--max-width); }
  .top-row { display: flex; justify-content: center; align-items: center; margin-bottom: 20px; }
  .header { font-size: 1.6em; font-weight: 800; margin: 0; white-space: nowrap; }

  .nav-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
  .nav-title { font-size: 1.2em; font-weight: 700; text-align: center; flex-grow: 1; white-space: nowrap; }

  .btn { background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 6px 12px; cursor: pointer; color: var(--text-muted); font-size: 0.9em; font-weight: 600; transition: all 0.2s; white-space: nowrap; }
  .btn:hover { background: var(--interactive-hover); color: var(--text-normal); }

  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px 0; margin-bottom: 24px; min-width: 250px; }
  .col-header { text-align: center; font-size: 0.8em; font-weight: 700; color: var(--text-muted); margin-bottom: 10px; }

  .cell { position: relative; display: flex; justify-content: center; align-items: center; height: 50px; cursor: pointer; }
  .circle { width: 46px; height: 46px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1em; font-weight: 600; z-index: 2; position: relative; transition: transform 0.1s; }
  .cell:hover .circle { transform: scale(1.12); }

  .cell.streak-left::before { content: ''; position: absolute; left: 0; right: 50%; top: 50%; height: 3px; background: var(--color); transform: translateY(-50%); z-index: 1; }
  .cell.streak-right::after { content: ''; position: absolute; left: 50%; right: 0; top: 50%; height: 3px; background: var(--color); transform: translateY(-50%); z-index: 1; }

  .cell.is-success .circle { background: var(--color); color: #111; }
  .cell.is-fail .circle { color: var(--text-muted); }
  .cell.is-untracked .circle, .cell.is-future .circle { color: var(--text-faint); opacity: 0.3; }
  .cell.is-today .circle { box-shadow: 0 0 0 2px var(--text-muted); }

  .year-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 24px; }
  .mini-month .grid { gap: 4px 0; margin-bottom: 0; min-width: unset; }
  .mini-month .cell { height: 26px; }
  .mini-month .circle { width: 22px; height: 22px; font-size: 0.75em; }
  .mini-title { text-align: center; font-weight: 700; margin-bottom: 10px; font-size: 1.1em; color: var(--text-normal); }

  .heatmap-wrapper { overflow-x: auto; padding-bottom: 10px; margin-bottom: 24px; }
  .heatmap-scroll { min-width: max-content; }
  .heatmap-months { position: relative; height: 18px; margin-left: 28px; }
  .heatmap-month-lbl { position: absolute; font-size: 0.7em; color: var(--text-muted); font-weight: 600; top: 0; }
  .heatmap-body { display: flex; gap: 8px; align-items: flex-start; }
  .heatmap-days { display: grid; grid-template-rows: repeat(7, 14px); gap: 4px; padding-top: 1px; }
  .heatmap-day-lbl { font-size: 0.65em; color: var(--text-muted); line-height: 14px; text-align: right; min-width: 20px; }

  .heatmap-grid { display: grid; grid-template-rows: repeat(7, 1fr); grid-auto-flow: column; gap: 4px; justify-content: start; }
  .heatmap-cell { width: 14px; height: 14px; border-radius: 3px; background: var(--background-modifier-border); cursor: pointer; transition: transform 0.1s; }
  .heatmap-cell:hover { transform: scale(1.3); }
  .heatmap-cell.empty { background: transparent; cursor: default; }

  .heatmap-cell.is-success { background: var(--color); }
  .heatmap-cell.is-fail { background: transparent; border: 0.8px solid var(--text-faint); box-sizing: border-box; }
  .heatmap-cell.is-untracked, .heatmap-cell.is-future { opacity: 0.3; }
  .heatmap-cell.is-today { box-shadow: 0 0 0 2px var(--text-normal); }

  .stats-panel { background: var(--background-secondary); border-radius: 10px; padding: 15px 10px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; text-align: center; border: 1px solid var(--background-modifier-border); min-width: 280px; }
  .stat { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; }
  .stat-val { font-size: 1.5em; font-weight: 800; line-height: 1.1; margin-bottom: 6px; }
  .stat-lbl { font-size: 0.65em; color: var(--text-muted); line-height: 1.2; font-weight: 600; text-align: center; }

  .val-current { color: #2CC742; }
  .val-longest { color: #DAA520; }
  .val-break { color: #FE5F58; }
  .val-white { color: var(--text-normal); }
</style>

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

// =============================================================================
// 5. RENDERING LOGIC
// =============================================================================
const mainView = container.querySelector("#main-view");
const titleEl = container.querySelector("#date-title");
const btnPrev = container.querySelector("#btn-prev");
const btnNext = container.querySelector("#btn-next");

function buildGrid(targetDt) {
    const grid = document.createElement("div");
    grid.className = "grid";

    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(h => {
        const header = document.createElement("div");
        header.className = "col-header";
        header.textContent = h;
        grid.appendChild(header);
    });

    const startOfMonth = targetDt.startOf("month");
    const endOfMonth = targetDt.endOf("month");
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

        if (cellData.state.type === "UNTRACKED") cellDiv.classList.add("is-untracked");
        else if (cellData.state.type === "FUTURE") cellDiv.classList.add("is-future");
        else if (cellData.state.type === "PENDING") cellDiv.classList.add("is-pending");
        else if (cellData.state.success) cellDiv.classList.add("is-success");
        else cellDiv.classList.add("is-fail");

        if (cellData.dt.hasSame(today, "day")) cellDiv.classList.add("is-today");
        if (!cellData.isCurrentMonth) cellDiv.style.opacity = "0.3";

        if (CONFIG.showStreakLines && cellData.state.success && cellData.state.type === "TRACKED") {
            const prev = cells[i-1];
            const next = cells[i+1];

            if (i % 7 !== 0 && prev && prev.state.success && prev.state.type === "TRACKED") {
                cellDiv.classList.add("streak-left");
            }
            if (i % 7 !== 6 && next && next.state.success && next.state.type === "TRACKED") {
                cellDiv.classList.add("streak-right");
            }
        }

        // Cleaned up UI logic leveraging the new helper function
        cellDiv.onclick = (e) => openOrMakeNote(cellData.dt, cellData.state.file, e);

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
    ["Mon", "", "Wed", "", "Fri", "", "Sun"].forEach(d => {
        let el = document.createElement("div");
        el.className = "heatmap-day-lbl";
        el.textContent = d;
        daysCol.appendChild(el);
    });

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

        const stateLabel = state.type === "PENDING" ? "Pending" : (state.success ? "Success" : (state.type === "UNTRACKED" ? "Untracked" : "Failed"));
        cell.title = `${cur.toFormat("yyyy-MM-dd")}: ${stateLabel}`;

        const cellDate = cur;

        // Cleaned up UI logic leveraging the new helper function
        cell.onclick = (e) => openOrMakeNote(cellDate, state.file, e);

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
    }
}

btnPrev.onclick = () => { activeDate = CONFIG.view === "month" ? activeDate.minus({ months: 1 }) : activeDate.minus({ years: 1 }); render(); };
btnNext.onclick = () => { activeDate = CONFIG.view === "month" ? activeDate.plus({ months: 1 }) : activeDate.plus({ years: 1 }); render(); };

render();
