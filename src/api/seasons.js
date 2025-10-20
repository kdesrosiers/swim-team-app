import { get, put } from "./client";

export const getSeasons = () => get("/api/seasons");
export const updateSeasons = (payload) => put("/api/seasons", payload);
