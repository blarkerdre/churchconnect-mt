import { describe, it, expect } from "vitest";
import { pickSmsFromSettings } from "./sms-sender.ts";
const s = { twilio_sender_name: "RCCG", twilio_sms_from: "+447888873207", twilio_sms_from_na: "+16475550123" };
describe("SMS sender", () => {
  it("uses church name for UK numbers", () => expect(pickSmsFromSettings(s, "+447700900000", "+44")).toBe("RCCG"));
  it("uses +1 number for Canada", () => expect(pickSmsFromSettings(s, "+16475550199", "+44")).toBe("+16475550123"));
  it("ignores names over 11 characters", () => expect(pickSmsFromSettings({ ...s, twilio_sender_name: "TooLongChurchName" }, "+447700900000", "+44")).toBe("+447888873207"));
});
