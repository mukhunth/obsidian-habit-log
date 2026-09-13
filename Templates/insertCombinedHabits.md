```dataviewjs
await dv.view("Scripts/combined-habits", {
    // === OPTIONAL SETTINGS ===
    // configPath: "",       // Defaults to "HabitsConfig.md" in vault root
    // folder: "",           // Defaults to Daily Notes plugin folder
    // month: "2025-01",     // Defaults to the current month
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
