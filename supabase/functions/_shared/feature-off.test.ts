import { assertEquals } from "jsr:@std/assert@1";
import { featureOffIn } from "./sender-guard.ts";
Deno.test("feature on when not listed", () => assertEquals(featureOffIn({ disabled_features: ["/trivia"] }, "/sms"), false));
Deno.test("feature off when listed", () => assertEquals(featureOffIn({ disabled_features: ["/sms"] }, "/sms"), true));
Deno.test("feature on with no settings", () => assertEquals(featureOffIn(null, "/phone-call"), false));
