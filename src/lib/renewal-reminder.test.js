import { describe, it, expect } from "vitest";
import { renewalState } from "./renewal-reminder";
const today = new Date("2026-11-20T12:00:00Z");
describe("renewalState", () => {
  it("shows when due within the reminder days", () => expect(renewalState({ dueDate: "2026-11-27", reminderDays: 7, today }).show).toBe(true));
  it("hides when due beyond the reminder days", () => expect(renewalState({ dueDate: "2026-11-28", reminderDays: 7, today }).show).toBe(false));
  it("0 turns it off", () => expect(renewalState({ dueDate: "2026-11-20", reminderDays: 0, today }).show).toBe(false));
  it("flags overdue", () => expect(renewalState({ dueDate: "2026-11-18", reminderDays: 7, today })).toMatchObject({ overdue: true, daysLeft: -2 }));
  it("flags due today", () => expect(renewalState({ dueDate: "2026-11-20", reminderDays: 7, today }).dueToday).toBe(true));
});
