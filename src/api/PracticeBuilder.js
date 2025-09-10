// at top
import { createPractice, listPractices } from "../api/practices";

// somewhere in your component
async function handleSavePractice() {
  try {
    // adapt these to your state/variables:
    const title = practiceTitle || "Untitled Practice";
    const date = new Date().toISOString().slice(0, 10);  // "YYYY-MM-DD"
    const pool = unit || "SCM"; // "SCY" | "SCM" | "LCM"

    // If you already compute yardage/time totals, reuse them:
    const totals = { yardage: totalYardage ?? 0, timeSeconds: totalTimeSeconds ?? 0 };

    const SectionSchema = new mongoose.Schema({
      type: { type: String },       // remove enum
      title: { type: String },      // still required if you want
      text: { type: String, default: "" }, // not required anymore
      yardage: { type: Number, default: 0 },
      timeSeconds: { type: Number, default: 0 }
    }, { _id: false });



    // If your section state is already what the API expects, pass it directly.
    // Otherwise map to { type, title, text, yardage, timeSeconds }
    const sectionsForApi = sections.map(s => ({
      type: s.type || "Main Set",
      title: s.title || s.type || "Section",
      text: s.text ?? s.content ?? "",
      yardage: s.yardage ?? 0,
      timeSeconds: s.timeSeconds ?? 0,
    }));

    const saved = await createPractice({
      title,
      date,
      pool,
      sections: sectionsForApi,
      totals,
    });

    console.log("Saved practice:", saved);
    // optional: show a toast, clear dirty state, etc.
  } catch (err) {
    console.error("Save failed:", err);
    alert("Save failed. Check console for details.");
  }
}

// (Optional) Load recent practices somewhere (e.g., on mount or a button)
async function fetchPractices() {
  const items = await listPractices();
  console.log("Practices:", items);
}
