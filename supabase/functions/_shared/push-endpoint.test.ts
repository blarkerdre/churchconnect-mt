import { assertEquals } from "jsr:@std/assert@1";
import { isKnownPushEndpoint } from "./push-endpoint.ts";

Deno.test("allows Google push", () => assertEquals(isKnownPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"), true));
Deno.test("allows Apple push", () => assertEquals(isKnownPushEndpoint("https://web.push.apple.com/abc"), true));
Deno.test("allows Microsoft push", () => assertEquals(isKnownPushEndpoint("https://wns2-ln2p.notify.windows.com/w/?token=x"), true));
Deno.test("refuses other sites", () => assertEquals(isKnownPushEndpoint("https://evil.example.com/push"), false));
Deno.test("refuses internal addresses", () => assertEquals(isKnownPushEndpoint("http://169.254.169.254/"), false));
Deno.test("refuses look-alike host", () => assertEquals(isKnownPushEndpoint("https://fcm.googleapis.com.evil.com/x"), false));
