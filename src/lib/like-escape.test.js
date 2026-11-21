import { describe, it, expect } from "vitest";
import { escapeLike } from "./like-escape";

describe("escapeLike", () => {
  it("turns wildcard characters in an email into literal characters", () => {
    expect(escapeLike("%@example.org")).toBe("\\%@example.org");
    expect(escapeLike("a_b@x.com")).toBe("a\\_b@x.com");
    expect(escapeLike("a\\b@x.com")).toBe("a\\\\b@x.com");
  });
  it("leaves an ordinary email unchanged", () => {
    expect(escapeLike("john.smith@example.org")).toBe("john.smith@example.org");
  });
});
