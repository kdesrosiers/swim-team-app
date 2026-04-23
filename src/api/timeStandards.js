import { get, post, put, del } from "./client";

export const listTimeStandards = ()        => get("/api/time-standards");
export const createTimeStandards = (body)  => post("/api/time-standards", body);
export const updateTimeStandards = (id, b) => put(`/api/time-standards/${id}`, b);
export const deleteTimeStandards = (id)    => del(`/api/time-standards/${id}`);
