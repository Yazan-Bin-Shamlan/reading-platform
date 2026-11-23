export type Anchor = { page: number; offset: number };
export type Position = { pageIndex: number; offset: number; percent: number };

/** What the reader shell can ask of the Original and Reading views. */
export type ViewHandle = {
  /** Scroll to a page, optionally to a fraction of it or to a text offset on it. */
  goTo(page: number, target?: { offset?: number; start?: number }): void;
  step(dir: 1 | -1): void;
  /** Text position of a DOM point inside the view (e.g. a selection end). */
  locate(node: Node, offset: number): { page: number; offset: number } | null;
  /** DOM ranges covering text [start, end) of a page, if that page is on screen. */
  ranges(page: number, start: number, end: number): Range[];
  pageText(page: number): string | null;
  root(): HTMLElement | null;
};

export type ViewProps = {
  docId: string;
  initial: Anchor | null;
  ref: React.Ref<ViewHandle>;
  onPosition: (p: Position & { current: number }) => void;
  /** Called when on-screen text changes, so highlights get redrawn. */
  onRendered: () => void;
};
