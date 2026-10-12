import test from "node:test";
import assert from "node:assert/strict";
import { filterMembers, getMemberSummary } from "./member-filters.js";

const members = [
  { id: "1", first_name: "Ada", last_name: "Cole", membership_status: "Active", gender: "Female", church_unit: "Choir", created_at: "2026-10-11T09:00:00Z", user_id: "user-1", wsf_centre_id: "cell-1" },
  { id: "2", first_name: "Ben", last_name: "Dale", membership_status: "New Convert", gender: "Male", church_unit: "Ushering", created_at: "2026-10-11T15:00:00Z", user_id: null, wsf_centre_id: "cell-2" },
  { id: "3", first_name: "Cara", last_name: "Evans", membership_status: "First Timer", gender: "Female", church_unit: "Choir", created_at: "2026-10-12T09:00:00Z", user_id: null, wsf_centre_id: "cell-1" },
];

test("member filters cover status, sex, dates, unit, account and Home Cell", () => {
  assert.deepEqual(filterMembers(members, { filters: { status: "Active" } }).map((member) => member.id), ["1"]);
  assert.deepEqual(filterMembers(members, { filters: { gender: "Female" } }).map((member) => member.id), ["1", "3"]);
  assert.deepEqual(filterMembers(members, { filters: { unit: "Choir" } }).map((member) => member.id), ["1", "3"]);
  assert.deepEqual(filterMembers(members, { filters: { account: "linked" } }).map((member) => member.id), ["1"]);
  assert.deepEqual(filterMembers(members, { filters: { wsfCentreId: "cell-2" } }).map((member) => member.id), ["2"]);
  assert.deepEqual(filterMembers(members, { filters: { dateFrom: new Date("2026-10-12T00:00:00Z") } }).map((member) => member.id), ["3"]);
  assert.deepEqual(filterMembers(members, { filters: { dateTo: new Date("2026-10-11T00:00:00Z") } }).map((member) => member.id), ["1", "2"]);
});

test("summary counts are calculated from the filtered members", () => {
  const filtered = filterMembers(members, { filters: { gender: "Female" } });
  assert.deepEqual(getMemberSummary(filtered), { total: 2, active: 1, newConverts: 0, firstTimers: 1 });
});