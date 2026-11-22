import { assertEquals } from "jsr:@std/assert@1";
import { ownStorageImageUrl } from "./storage-image-url.ts";

Deno.env.set("SUPABASE_URL", "https://proj.supabase.co");

Deno.test("allows this app's own storage file", () =>
  assertEquals(ownStorageImageUrl("https://proj.supabase.co/storage/v1/object/sign/church-documents/a/b.png?token=x") !== null, true));
Deno.test("refuses another website", () =>
  assertEquals(ownStorageImageUrl("https://evil.example.com/storage/v1/object/public/x.png"), null));
Deno.test("refuses internal addresses", () =>
  assertEquals(ownStorageImageUrl("http://169.254.169.254/latest/meta-data"), null));
Deno.test("refuses non-storage paths on own host", () =>
  assertEquals(ownStorageImageUrl("https://proj.supabase.co/functions/v1/send-sms"), null));
Deno.test("refuses look-alike host", () =>
  assertEquals(ownStorageImageUrl("https://proj.supabase.co.evil.com/storage/v1/object/public/x.png"), null));
