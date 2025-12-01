import mongoose from "mongoose";

export async function connectMongo() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/swim_team";
  // Optional debug log:
  console.log("[db] using", uri);
  await mongoose.connect(uri, { autoIndex: true });
}
