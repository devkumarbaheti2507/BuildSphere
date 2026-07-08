import type { GeneratedFile } from "@buildsphere/shared-types";

const writeString = (
  buffer: Buffer,
  value: string,
  offset: number,
  length: number,
): void => {
  buffer.write(value.slice(0, length), offset, length, "utf8");
};

const writeOctal = (
  buffer: Buffer,
  value: number,
  offset: number,
  length: number,
): void => {
  writeString(
    buffer,
    value.toString(8).padStart(length - 1, "0") + "\0",
    offset,
    length,
  );
};

export const createTarArchive = (files: GeneratedFile[]): Buffer => {
  const chunks: Buffer[] = [];
  for (const file of files) {
    const content = Buffer.from(file.content, "utf8");
    const header = Buffer.alloc(512, 0);
    writeString(header, file.path, 0, 100);
    writeOctal(header, 0o644, 100, 8);
    writeOctal(header, 0, 108, 8);
    writeOctal(header, 0, 116, 8);
    writeOctal(header, content.length, 124, 12);
    writeOctal(header, Math.floor(Date.now() / 1_000), 136, 12);
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeString(header, "ustar", 257, 6);
    writeString(header, "00", 263, 2);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeOctal(header, checksum, 148, 8);
    chunks.push(header, content);
    const padding = (512 - (content.length % 512)) % 512;
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1_024));
  return Buffer.concat(chunks);
};
