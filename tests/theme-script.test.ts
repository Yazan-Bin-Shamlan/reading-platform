import { describe, expect, it } from "vitest";
import { themeScript } from "@/lib/preferences/themes";

// Runs the inline <head> script against a fake document.
function run(cookie: string, prefersDark = false) {
  const classes = new Set<string>();
  const html = {
    classList: {
      add: (c: string) => classes.add(c),
      remove: (...c: string[]) => c.forEach((x) => classes.delete(x)),
    },
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
  };
  new Function("document", "matchMedia", themeScript)(
    { cookie, documentElement: html },
    () => ({ matches: prefersDark }),
  );
  return { classes: [...classes], choice: html.dataset.themeChoice, scheme: html.style.colorScheme };
}

describe("theme script", () => {
  it("applies the saved theme", () => {
    expect(run("theme=sepia")).toEqual({ classes: ["sepia"], choice: "sepia", scheme: "light" });
    expect(run("a=1; theme=black")).toEqual({ classes: ["black"], choice: "black", scheme: "dark" });
  });

  it("follows the system when nothing is saved", () => {
    expect(run("", true).classes).toEqual(["dark"]);
    expect(run("", false).classes).toEqual(["light"]);
  });

  it("ignores unknown values", () => {
    expect(run("theme=<script>").choice).toBe("system");
  });
});
