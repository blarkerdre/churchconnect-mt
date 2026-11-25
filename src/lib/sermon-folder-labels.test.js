import { describe, expect, it } from "vitest";
import { sermonFolderLabels } from "./sermon-folder-labels.js";

const NAMES = { t1: "WCI Cardiff", t2: "Demo Church" };

describe("sermonFolderLabels", () => {
  it("leaves a unique folder name unchanged", () => {
    const labels = sermonFolderLabels([{ id: "f1", name: "CHoP", tenant_id: "t1" }], NAMES);
    expect(labels).toEqual({ f1: "CHoP" });
  });

  it("shows the church when the same folder name exists in two churches", () => {
    const labels = sermonFolderLabels(
      [
        { id: "f1", name: "CHoP", tenant_id: "t1" },
        { id: "f2", name: "CHoP", tenant_id: "t2" },
      ],
      NAMES,
    );
    expect(labels).toEqual({ f1: "CHoP (WCI Cardiff)", f2: "CHoP (Demo Church)" });
  });

  it("leaves the name alone when the church cannot be resolved", () => {
    const labels = sermonFolderLabels(
      [
        { id: "f1", name: "CHoP", tenant_id: "t1" },
        { id: "f2", name: "CHoP", tenant_id: "unknown" },
      ],
      NAMES,
    );
    expect(labels).toEqual({ f1: "CHoP (WCI Cardiff)", f2: "CHoP" });
  });

  it("returns nothing when there are no folders", () => {
    expect(sermonFolderLabels([], NAMES)).toEqual({});
    expect(sermonFolderLabels(undefined, NAMES)).toEqual({});
  });
});
