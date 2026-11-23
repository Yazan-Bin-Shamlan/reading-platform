"use client";

import { MAX_UPLOAD_BYTES } from "@/lib/limits";
import { inspectPdf, PdfError, sha256Hex } from "@/lib/pdf/inspect";
import { useUploads, type UploadError } from "./store";

class UploadFailure extends Error {
  constructor(public code: UploadError) {
    super(code);
  }
}

const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

/** Adds files to the queue and processes them one after another. */
export function enqueueFiles(files: Iterable<File>) {
  for (const file of files) {
    const id = crypto.randomUUID();
    useUploads.getState().add({ id, file, status: "reading", progress: 0, title: file.name });
    queue = queue.then(() => process(id, file));
  }
}

let queue: Promise<void> = Promise.resolve();

async function process(id: string, file: File) {
  const { update } = useUploads.getState();
  try {
    if (!isPdf(file)) throw new UploadFailure("notPdf");
    if (file.size > MAX_UPLOAD_BYTES) throw new UploadFailure("tooLarge");

    // 1. Read it locally: metadata, cover, language, table of contents.
    const data = await file.arrayBuffer();
    const [info, sha256] = await Promise.all([inspectPdf(file, data), sha256Hex(data)]);
    update(id, {
      title: info.title,
      type: info.type,
      textStatus: info.textStatus,
      coverUrl: info.cover ? URL.createObjectURL(info.cover) : undefined,
      status: "uploading",
    });

    // 2. Upload straight to storage (not through our server).
    const start = await api("/api/uploads", { byteSize: file.size, contentType: "application/pdf", sha256 });
    const started = (await start.json()) as
      | { existingId: string }
      | { key: string; target: { url: string; headers: Record<string, string> } };
    if ("existingId" in started) {
      update(id, { status: "done", docId: started.existingId, duplicate: true, progress: 1 });
      return;
    }
    const { key, target } = started;
    await put(target.url, target.headers, file, (p) => update(id, { progress: p }));

    // 3. Verify on the server and add to the library.
    update(id, { status: "saving", progress: 1 });
    const form = new FormData();
    const { cover, ...rest } = info;
    form.set("meta", JSON.stringify({ ...rest, uploadKey: key, sha256 }));
    if (cover) form.set("cover", cover, "cover.jpg");
    const res = await fetch("/api/documents", { method: "POST", body: form });
    if (!res.ok) throw new UploadFailure(res.status === 401 ? "unauthorized" : "generic");
    const { id: docId, duplicate } = (await res.json()) as { id: string; duplicate: boolean };
    update(id, { status: "done", docId, duplicate });
  } catch (e) {
    const code: UploadError =
      e instanceof UploadFailure ? e.code : e instanceof PdfError ? e.code : e instanceof TypeError ? "network" : "generic";
    update(id, { status: "error", error: code });
  }
}

async function api(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new UploadFailure("unauthorized");
  if (!res.ok) throw new UploadFailure("generic");
  return res;
}

/** XHR rather than fetch: it reports upload progress. */
function put(url: string, headers: Record<string, string>, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new UploadFailure(xhr.status === 413 ? "tooLarge" : "generic"));
    xhr.onerror = () => reject(new UploadFailure("network"));
    xhr.send(file);
  });
}
