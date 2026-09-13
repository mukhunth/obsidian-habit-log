```dataviewjs
await dv.view("Scripts/habit-tracker", {
    // === REQUIRED ===
    title: "Habit Title",
    property: "",      // Property name to track (boolean/number)
    trackingStart: "", // Format: YYYY-MM-DD

    // === OPTIONAL ===
    // folder: "",          // Defaults to Daily Notes folder
    // trackingEnd: "",     // Defaults to today
    // inverse: false,      // If true: empty/missing = success
    // color: "#2CC742",    // Defaults to theme accent color
    // color: "#E62E31",

    // === DISPLAY ===
    view: "month",          // "month" | "year" | "heatmap"
    showStreakLines: true,  // Connect consecutive days with lines
    maxWidth: "100%"        // e.g., "100%" or "450px"
});
```
