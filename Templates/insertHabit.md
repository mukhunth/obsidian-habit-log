```dataviewjs
await dv.view("Scripts/habit-tracker", {
    // === REQUIRED ===
    property: "habit1",      // Property name to track (e.g. habit1, habit2, habit3)

    // === OPTIONAL SETTINGS (Overrides settings in the global config file) ===
    // configPath: "",      // Defaults to "HabitsConfig.md" in vault root
    // folder: "",          // Defaults to Daily Notes plugin folder
    // startDate: "",       // (Required for stats & inverse) Format: YYYY-MM-DD
    // endDate: "",         // Defaults to today
    // inverse: false,      // If true: empty/missing = success
    // color: "theme",      // Hex code or "theme" for vault accent

    // view: "month",          // "month" | "year" | "heatmap"
    // showStreakLines: true,  // Connect consecutive days with lines
    // maxWidth: "100%"        // e.g., "100%" or "450px"
});
```
