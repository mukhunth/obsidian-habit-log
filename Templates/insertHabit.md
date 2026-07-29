```dataviewjs
dv.view("Scripts/habit-tracker", {

    // REQUIRED SETTINGS
    title: "Title",
    property: "", // boolean or numeric property to track
    trackingStart: "", // YYYY-MM-DD
    
    //OPTIONAL SETTINGS
    folder: "DailyNotes", // default: "" -searches entire vault
    trackingEnd: "", // default: "" -current day
    inverse: false, // default: false
    // true  = missing note or 0 = success
    // false = logged 'true' or >0 = success
    // color defaults to theme accent color
    // color: "#2CC742", // green
    // color: "#E62E31", // red
    view: "month", // default: "month" -options:"year","heatmap"
    showStreakLines: true, // default: false
    maxWidth: "" // Default: "100%". e.g., "450px" to restrict width
    
    });
```
