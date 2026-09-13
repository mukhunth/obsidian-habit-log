```dataviewjs
await dv.view("Scripts/combined-habits", {
    // === OPTIONAL SETTINGS ===
    // folder: "",          // Defaults to Daily Notes plugin folder or vault root
    // month: "2023-10",    // Defaults to the current month

    // === HABITS CONFIG ===
    habits: [
        {
            property: "habit1",
            title: "Habit 1",
            color: "#ff5252"
        },
        {
            property: "habit2",
            title: "Habit 2 (Inverted)",
            inverse: true,
            startDate: "YYYY-MM-DD", // Required for inverted habits! Format: YYYY-MM-DD
            color: "#4caf50"
        },
        {
            property: "habit3",
            title: "Habit 3"         // Uses vault's default theme accent color
        }
    ]
});
```
