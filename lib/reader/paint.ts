// Draws highlights with the CSS Custom Highlight API: no extra elements in the
// text, so the same ranges work over Reading mode's paragraphs and the PDF's
// text layer. Styles live in components/reader/reader.css (::highlight(name)).

export const canPaint = () => typeof CSS !== "undefined" && "highlights" in CSS;

export function paint(name: string, ranges: AbstractRange[]) {
  if (!canPaint()) return;
  if (ranges.length) CSS.highlights.set(name, new Highlight(...ranges));
  else CSS.highlights.delete(name);
}
