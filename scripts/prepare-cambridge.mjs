import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, openAsBlob } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sources = JSON.parse(
  await readFile(path.join(root, "scripts/material-sources.json"), "utf8"),
);
const cache = path.join(root, ".cache/cambridge");
const destination = path.join(root, "public/library/cambridge");

/** Check the pinned digest without reading a large download into memory. */
async function checksum(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

/** Download a fixed public source to the build cache and reject changed or partial files. */
async function download(source, name) {
  const file = path.join(cache, name);
  const cached = await stat(file).catch(() => null);
  if (cached?.size === source.size && (await checksum(file)) === source.sha256)
    return file;
  console.log(
    `Downloading Cambridge ${name} (${Math.round(source.size / 1024 / 1024)} MB)…`,
  );
  const temporary = `${file}.partial`;
  try {
    const response = await fetch(source.url, {
      signal: AbortSignal.timeout(240_000),
    });
    if (!response.ok || !response.body)
      throw new Error(`Source returned HTTP ${response.status}.`);
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(temporary),
    );
    if (
      (await stat(temporary)).size !== source.size ||
      (await checksum(temporary)) !== source.sha256
    ) {
      throw new Error(
        "The downloaded file does not match the verified Cambridge material.",
      );
    }
    await rename(temporary, file);
    return file;
  } catch (error) {
    await rm(temporary, { force: true });
    throw new Error(`Could not prepare Cambridge ${name}: ${error.message}`);
  }
}

/** Expand only the known numbered MP3 files; archive paths are never written to disk. */
async function extractTracks(archive) {
  const reader = new ZipReader(new BlobReader(await openAsBlob(archive)), {
    useWebWorkers: false,
  });
  try {
    const entries = await reader.getEntries();
    const audio = new Map();
    for (const entry of entries) {
      const match = entry.filename.match(/(?:^|\/)CGtoIELTS_(\d{2})\.mp3$/i);
      if (entry.directory || !match) continue;
      const number = Number(match[1]);
      if (number < 1 || number > sources.tracks || audio.has(number))
        throw new Error(
          "Unexpected or duplicate audio track in the Cambridge archive.",
        );
      audio.set(number, entry);
    }
    if (audio.size !== sources.tracks)
      throw new Error(
        `Expected ${sources.tracks} audio tracks, found ${audio.size}.`,
      );
    for (let number = 1; number <= sources.tracks; number++) {
      const entry = audio.get(number);
      const output = path.join(
        destination,
        `track-${String(number).padStart(2, "0")}.mp3`,
      );
      const existing = await stat(output).catch(() => null);
      if (existing?.size === entry.uncompressedSize) continue;
      const blob = await entry.getData(new BlobWriter("audio/mpeg"), {
        checkSignature: true,
        useWebWorkers: false,
      });
      await writeFile(output, new Uint8Array(await blob.arrayBuffer()));
    }
  } finally {
    await reader.close();
  }
}

await mkdir(cache, { recursive: true });
await mkdir(destination, { recursive: true });
const [pdf, archive] = await Promise.all([
  download(sources.pdf, "guide.pdf"),
  download(sources.audio, "audio.zip"),
]);
await copyFile(pdf, path.join(destination, "guide.pdf"));
await extractTracks(archive);
console.log(
  `Cambridge library ready: ${sources.pages} PDF pages and ${sources.tracks} audio tracks.`,
);
