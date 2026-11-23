// Turns a JATS article (Europe PMC's full text XML) into plain HTML for
// htmlToPages: title, abstract and body text, with section titles as
// headings. Figures, tables, formulas and references are left out.

const DROP = ["fig", "fig-group", "table-wrap", "table-wrap-group", "disp-formula", "graphic", "inline-graphic", "media", "supplementary-material", "ref-list", "label", "alternatives"];
const RENAME: Record<string, string> = { list: "ul", "list-item": "li", "disp-quote": "blockquote", "boxed-text": "section", "def-list": "dl" };

// The end of a tag name: `list` must not match `list-item`.
const END = "(?=[\\s/>])";
const pick = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}${END}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "";

function toHtml(xml: string): string {
  let s = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of DROP) s = s.replace(new RegExp(`<${tag}${END}[^>]*/>|<${tag}${END}[^>]*>[\\s\\S]*?</${tag}>`, "g"), " ");
  for (const [from, to] of Object.entries(RENAME)) s = s.replace(new RegExp(`<(/?)${from}${END}[^>]*>`, "g"), `<$1${to}>`);
  // Section titles become headings by depth: h2 at the top, h3 and h4 below.
  let depth = 0;
  return s.replace(/<(\/?)(sec|title)(?=[\s/>])[^>]*>/g, (_, close: string, tag: string) => {
    if (tag === "sec") {
      depth += close ? -1 : 1;
      return close ? "</section>" : "<section>";
    }
    return `<${close}h${Math.min(Math.max(depth, 1) + 1, 4)}>`;
  });
}

export function jatsToHtml(xml: string): string {
  const title = pick(pick(xml, "front"), "article-title");
  const abstract = pick(xml, "abstract");
  const body = pick(xml, "body");
  return [
    "<html><body>",
    title && `<h1>${title.replace(/<[^>]+>/g, "")}</h1>`,
    abstract && `${/^\s*<title[\s>]/.test(abstract) ? "" : "<h2>Abstract</h2>"}${toHtml(abstract)}`,
    toHtml(body),
    "</body></html>",
  ].join("");
}
