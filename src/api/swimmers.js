// src/api/swimmers.js
import { get } from "./client";

export async function listSwimmers() {
  return get("/api/swimmers");
}
