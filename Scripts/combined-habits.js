// =============================================================================
// 1. CONFIGURATION
// =============================================================================
const DateTime = dv.luxon.DateTime;
const today = DateTime.now().startOf('day');

let globalConfig = {};
try {
    const configPath = input.configPath || "HabitsConfig.md";
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

const CONFIG = Object.assign({
    folder: "",
    month: today.toFormat("yyyy-MM"),
    habits: [],
    defaultColor: "var(--interactive-accent)"
}, input);

if (input.defaultColor === "theme") {
    input.defaultColor = "var(--interactive-accent)";
}
const uniformColorOverride = input.defaultColor;

const resolvedHabits = CONFIG.habits.map(h => {
    let local = typeof h === "string" ? { property: h } : h;
    let global = globalConfig[local.property] || {};
    let merged = Object.assign({}, global, local);
    if (merged.color === "theme") merged.color = "var(--interactive-accent)";
    return merged;
});

if (!resolvedHabits || !Array.isArray(resolvedHabits) || resolvedHabits.length === 0) {
    dv.paragraph("⚠️ No habits configured for combined view.");
    return;
}

const targetMonth = DateTime.fromISO(CONFIG.month + "-01").startOf('month');
const daysInMonth = targetMonth.daysInMonth;

// =============================================================================
// 2. DATA ENGINE
// =============================================================================
const pages = dv.pages().where(p =>
    p.file.day &&
    (!CONFIG.folder || p.file.folder.includes(CONFIG.folder)) &&
    p.file.day.year === targetMonth.year &&
    p.file.day.month === targetMonth.month
);

const noteMap = new Map();
for (let p of pages) {
    noteMap.set(p.file.day.toFormat("yyyy-MM-dd"), p);
}

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
// 3. UI RENDERER & CSS
// =============================================================================
const container = dv.el("div", "", { cls: "combined-habits-wrapper" });

container.innerHTML = `
<style>
.combined-habits-wrapper {
    font-family: var(--font-interface);
    width: 100%;
    overflow-x: auto;
    padding: 10px 20px;
}
.ch-header {
    font-size: 1.4em;
    font-weight: 700;
    margin-bottom: 15px;
    text-align: center;
    color: var(--text-normal);
}
.ch-grid {
    display: grid;
    grid-template-columns: max-content repeat(${daysInMonth}, 1fr);
    gap: 0;
    min-width: max-content;
    align-items: stretch;
}
.ch-row-header {
    font-size: 0.9em;
    font-weight: 600;
    padding: 8px 15px 8px 0;
    display: flex;
    align-items: center;
    color: var(--text-normal);
    white-space: nowrap;
    border-bottom: 1px solid var(--background-modifier-border);
    border-right: 1px solid var(--background-modifier-border);
}
.ch-col-header {
    font-size: 0.75em;
    color: var(--text-muted);
    text-align: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--background-modifier-border);
    border-right: 1px solid var(--background-modifier-border);
}
.ch-cell-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 6px 4px;
    border-bottom: 1px solid var(--background-modifier-border);
    border-right: 1px solid var(--background-modifier-border);
}
.ch-circle {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--background-modifier-border);
    cursor: pointer;
    transition: transform 0.1s;
    box-sizing: border-box;
}
.ch-circle:hover {
    transform: scale(1.2);
}
.ch-circle.is-future {
    opacity: 0.2;
    cursor: default;
}
.ch-circle.is-future:hover {
    transform: none;
}
.ch-circle.is-fail {
    background: transparent;
    border: 1px solid var(--background-modifier-border);
}
.ch-circle.is-today {
    box-shadow: 0 0 0 2px var(--text-normal);
}
</style>
`;

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

    const hColor = uniformColorOverride || habit.color || "var(--interactive-accent)";

    for (let i = 1; i <= daysInMonth; i++) {
        const d = targetMonth.set({ day: i });
        const dateKey = d.toFormat("yyyy-MM-dd");

        let isTriggered = false;
        const page = noteMap.get(dateKey);

        if (page) {
            const rawVal = page[habit.property];
            if (rawVal === true || String(rawVal).toLowerCase() === "true" || (typeof rawVal === "number" && rawVal > 0)) {
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

        const habitStart = habit.startDate ? DateTime.fromISO(habit.startDate).startOf('day') : null;
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
            // Same click behavior as the individual tracker
            circle.onclick = (e) => openOrMakeNote(d, page ? page.file : null, e);
        }

        if (d.hasSame(today, "day")) {
            circle.classList.add("is-today");
        }

        cellWrapper.appendChild(circle);
        gridEl.appendChild(cellWrapper);
    }
});

container.appendChild(gridEl);
