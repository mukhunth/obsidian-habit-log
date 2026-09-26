```dataviewjs
await dv.view("Scripts/habit-log", {
    // === OPTIONAL SETTINGS ===
    // configPath: "",       // Defaults to "LogIndex.md" in vault root
    // folder: "",           // Defaults to Daily Notes plugin folder
    // view: "monthly",      // "monthly" (default) or "sparkline"
    // month: "2025-01",     // The target ending month (defaults to current month)
    // monthsToShow: 1,      // Number of months to show (defaults to 1, or 12 for sparkline)
    // monthsPerWrap: 3,     // For sparkline view: how many months before wrapping (default 3)
    // compact: false,       // For sparkline view: completely hide habits in wrap rows where they have 0 active days
    // defaultColor: "theme",// Master uniform override for the whole grid

    // === HABITS ===
    // Pass as strings to inherit all settings from global config,
    // or as objects to override specific properties locally
    habits: [
        "habit1",
        "habit2",
        "habit3",
        // Example of a local override:
        // { property: "habit3", title: "Read (Local Override)", color: "theme" }
    ]
});
```
