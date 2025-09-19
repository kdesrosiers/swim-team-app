import { get, put } from "./client";

export const getConfig = () => get("/api/config");
export const updateConfig = (payload) => put("/api/config", payload);
