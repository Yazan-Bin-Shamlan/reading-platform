import { describe, expect, it } from "vitest";
import { licenseLabel, normalizeLicense } from "@/lib/sources/license";

describe("normalizeLicense", () => {
  it("reads Creative Commons URLs, any version or scheme", () => {
    expect(normalizeLicense("http://creativecommons.org/licenses/by/3.0/")).toEqual({
      code: "cc-by",
      url: "https://creativecommons.org/licenses/by/3.0/",
    });
    expect(normalizeLicense("https://creativecommons.org/licenses/by-nc-nd/4.0/")?.code).toBe("cc-by-nc-nd");
    expect(normalizeLicense("http://creativecommons.org/publicdomain/zero/1.0/")?.code).toBe("cc0");
  });

  it("reads short codes from OpenAlex and DOAB", () => {
    expect(normalizeLicense("cc-by-sa")?.code).toBe("cc-by-sa");
    expect(normalizeLicense("CC-BY-SA")?.code).toBe("cc-by-sa");
    expect(normalizeLicense("public-domain")?.code).toBe("public-domain");
  });

  it("refuses anything that isn't public domain or CC", () => {
    expect(normalizeLicense("http://arxiv.org/licenses/nonexclusive-distrib/1.0/")).toBeNull();
    expect(normalizeLicense("publisher-specific-oa")).toBeNull();
    expect(normalizeLicense("other-oa")).toBeNull();
    expect(normalizeLicense("implied-oa")).toBeNull();
    expect(normalizeLicense(null)).toBeNull();
  });

  it("labels licenses for people", () => {
    expect(licenseLabel("cc-by-sa", "https://creativecommons.org/licenses/by-sa/4.0/")).toBe("CC BY-SA 4.0");
    expect(licenseLabel("public-domain")).toBe("Public domain");
  });
});
