# Habit Configuration

Keep all your global habit settings here. The trackers will silently fetch this file in the background so you don't have to re-type settings like colors, start dates, and titles on every single card.

This file can be re-named and moved anywhere, or even split up, just make sure to use the configPath property in each code block where you insert a habit or a combined view

> ## Property Reference
> Here is an example showing every possible property you can set.
> Only the property key itself is strictly required, everything else is optional, like in example 2. Use strict json syntax.
> ```js
>   {
>   "my_habit_key1": {
>     "title": "My Habit", // The display name
>     "color": "#ff5252", // Hex code, or use "theme" for vault accent
>     "inverse": false, // If true, a missing note/false counts as success
>     "startDate": "2025-01-01", // (Required for stats & inverse) When tracking began
>     "endDate": "2025-12-31", // When tracking stopped (YYYY-MM-DD)
>     "folder": "DailyNotes", // Specific folder for this habit's notes
>     "view": "month", // Force default view: "month", "year", "heatmap"
>     "showStreakLines": true, // Draw lines between consecutive days (month view)
>     "maxWidth": "100%" // CSS width constraint (e.g., "450px")
>   },
>   "my_habit_key2": {}
>   }
> ```

## The scripts will only read the data inside the `json` code block below

```json
{
  "habit1": {
    "title": "Workout",
    "color": "#0357e8",
    "folder": "DailyNotes",
    "startDate": "2025-01-01",
    "showStreakLines": true
  },
  "habit2": {
    "title": "Eat Healthy",
    "inverse": true,
    "startDate": "2025-01-01",
    "color": "#2CC742",
    "view": "year"
  },
  "habit3": {
    "title": "Read",
    "folder": "DailyNotes",
    "color": "#ff4126",
    "startDate": "2025-01-01",
    "view": "heatmap"
  }
}
```
