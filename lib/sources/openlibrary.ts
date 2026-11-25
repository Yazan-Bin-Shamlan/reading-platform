import "server-only";
import { mainTitle, pickCover, type OlDoc } from "./covers";
import { cached, getJson } from "./http";

const BASE = "https://openlibrary.org";
/** A found cover is kept a month; so is "none", so a miss isn't asked again on every visit. */
const TTL = 30 * 86400;

export const olIsbnUrl = (isbn: string) => `${BASE}/search.json?q=isbn:${isbn}&fields=title,cover_i&limit=1`;
export const olTitleUrl = (title: string, author?: string) =>
  `${BASE}/search.json?${new URLSearchParams({ title: mainTitle(title), ...(author ? { author } : {}), fields: "title,cover_i", limit: "5" })}`;

export const olCoverUrl = (id: number, size: "M" | "L") => `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;

/** Open Library's cover ID for a book: by ISBN when we have one, else by title and author. */
export async function findCover({ title, author, isbn }: { title: string; author?: string; isbn?: string }): Promise<number | null> {
  const { id } = await cached(`openlibrary:cover:${isbn ?? ""}:${title}:${author ?? ""}`, TTL, async () => {
    if (isbn) {
      const { docs } = await getJson<{ docs: OlDoc[] }>(olIsbnUrl(isbn));
      const found = pickCover(docs, title, true);
      if (found) return { id: found };
    }
    const { docs } = await getJson<{ docs: OlDoc[] }>(olTitleUrl(title, author));
    return { id: pickCover(docs, title, false) };
  });
  return id;
}
