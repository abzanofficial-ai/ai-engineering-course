import { describe, expect, it } from "vitest";
import { copyTextFor } from "@/components/copy-buttons";

describe("copyTextFor", () => {
  it("copies only commands, without the $ prompt, from shell blocks", () => {
    expect(copyTextFor("$ mkdir lab\n$ cd lab\nOutput line\n", "shell")).toBe("mkdir lab\ncd lab");
  });
  it("copies other blocks verbatim", () => {
    expect(copyTextFor("print('hi')\n", "all")).toBe("print('hi')");
  });
});
