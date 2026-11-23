// Which items we may show: public domain or a Creative Commons license.
// Everything else (unknown, "free to read", publisher-specific, arXiv's
// non-exclusive license) is left out, because we fetch, cache and display
// the file itself.

export const openLicenses = [
  "public-domain",
  "cc0",
  "cc-by",
  "cc-by-sa",
  "cc-by-nd",
  "cc-by-nc",
  "cc-by-nc-sa",
  "cc-by-nc-nd",
] as const;
export type OpenLicense = (typeof openLicenses)[number];

const CC = /creativecommons\.org\/(licenses|publicdomain)\/([a-z-]+)\/?([\d.]+)?/i;

/**
 * A license URL, short code ("cc-by", "CC-BY-SA", "public-domain") or
 * statement, as one of our codes and a canonical URL. Null if it isn't one
 * we accept.
 */
export function normalizeLicense(raw: string | null | undefined): { code: OpenLicense; url: string | null } | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = s.match(CC);
  if (m) {
    const kind = m[2].toLowerCase();
    const version = m[3] ?? (kind === "zero" ? "1.0" : "4.0");
    if (m[1].toLowerCase() === "publicdomain") {
      if (kind === "zero") return { code: "cc0", url: `https://creativecommons.org/publicdomain/zero/${version}/` };
      if (kind === "mark") return { code: "public-domain", url: "https://creativecommons.org/publicdomain/mark/1.0/" };
      return null;
    }
    const code = `cc-${kind}` as OpenLicense;
    return openLicenses.includes(code) ? { code, url: `https://creativecommons.org/licenses/${kind}/${version}/` } : null;
  }
  const code = s.toLowerCase().replace(/[\s_]+/g, "-").replace(/-?\d(\.\d)?$/, "");
  if (code === "public-domain" || code === "pd" || code === "publicdomain") return { code: "public-domain", url: null };
  if (code === "cc0" || code === "cc-zero") return { code: "cc0", url: "https://creativecommons.org/publicdomain/zero/1.0/" };
  if ((openLicenses as readonly string[]).includes(code)) {
    return { code: code as OpenLicense, url: `https://creativecommons.org/licenses/${code.slice(3)}/4.0/` };
  }
  return null;
}

/** "CC BY-SA 4.0", "Public domain", "CC0". */
export function licenseLabel(code: string, url?: string | null): string {
  if (code === "public-domain") return "Public domain";
  if (code === "cc0") return "CC0";
  const version = url?.match(/\/([\d.]+)\/?$/)?.[1];
  return `CC ${code.slice(3).toUpperCase()}${version ? ` ${version}` : ""}`;
}
