import { get, put } from "./client";

export const getAcronyms = () => get("/api/acronyms");
export const updateAcronyms = (payload) => put("/api/acronyms", payload);
