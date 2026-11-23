// OAI-PMH, the standard harvesting protocol arXiv and DOAB both offer for
// incremental sync ("records changed since …", page by page).
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  // Elements that may repeat must always parse as arrays.
  isArray: (name) => ["record", "element", "field", "author", "setSpec"].includes(name),
});

export type OaiRecord = { identifier: string; datestamp: string; deleted: boolean; metadata: unknown };
export type OaiPage = { records: OaiRecord[]; resumptionToken: string | null; error: string | null };

type Raw = {
  "OAI-PMH": {
    error?: { "@code": string } | string;
    ListRecords?: { record?: RawRecord[]; resumptionToken?: string | { "#text"?: string } };
    GetRecord?: { record?: RawRecord[] };
  };
};
type RawRecord = {
  header: { identifier: string; datestamp: string; "@status"?: string };
  metadata?: unknown;
};

export function parseOai(xml: string): OaiPage {
  const root = (parser.parse(xml) as Raw)["OAI-PMH"];
  const error = root.error ? (typeof root.error === "string" ? root.error : root.error["@code"]) : null;
  const list = root.ListRecords ?? root.GetRecord;
  const token = root.ListRecords?.resumptionToken;
  const resumptionToken = (typeof token === "string" ? token : token?.["#text"]) || null;
  return {
    error,
    resumptionToken,
    records: (list?.record ?? []).map((r) => ({
      identifier: r.header.identifier,
      datestamp: r.header.datestamp,
      deleted: r.header["@status"] === "deleted",
      metadata: r.metadata,
    })),
  };
}

export function listRecordsUrl(base: string, prefix: string, from: string | null, token: string | null) {
  const params = new URLSearchParams({ verb: "ListRecords" });
  if (token) params.set("resumptionToken", token);
  else {
    params.set("metadataPrefix", prefix);
    if (from) params.set("from", from);
  }
  return `${base}?${params}`;
}
