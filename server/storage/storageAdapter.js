import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { inflateRawSync } from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Private directory outside public static assets
export const UPLOAD_DIR = path.resolve(__dirname, 'private_uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const MIME_BY_EXTENSION = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const ALLOWED_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);
export const ALLOWED_MIME_TYPES = Object.values(MIME_BY_EXTENSION);
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const DOCX_PARTS = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml'];
const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

export class DocumentValidationError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'DocumentValidationError';
    this.statusCode = statusCode;
  }
}

export function sanitizeFilename(filename) {
  if (!filename) return 'document';
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function validateDocument(originalName, mimeType, fileBuffer) {
  if (!originalName) {
    return { ok: false, error: 'Document filename is missing.', statusCode: 400 };
  }
  if (!Buffer.isBuffer(fileBuffer)) {
    return { ok: false, error: 'Uploaded document data is invalid.', statusCode: 400 };
  }
  if (fileBuffer.length > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: 'File size exceeds the 5MB limit.',
      statusCode: 413,
    };
  }

  const ext = path.extname(originalName).toLowerCase();
  const expectedMimeType = MIME_BY_EXTENSION[ext];
  if (!expectedMimeType) {
    return {
      ok: false,
      error: `Unsupported file extension (${ext || 'none'}). Only PDF and DOCX files are allowed.`,
      statusCode: 415,
    };
  }
  if (mimeType !== expectedMimeType) {
    return {
      ok: false,
      error: 'File extension and MIME type do not match a supported document format.',
      statusCode: 415,
    };
  }

  if (ext === '.pdf' && fileBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return {
      ok: false,
      error: 'The uploaded file does not have a valid PDF signature.',
      statusCode: 415,
    };
  }

  if (ext === '.docx' && !isValidDocx(fileBuffer)) {
    return {
      ok: false,
      error: 'The uploaded file is not a valid DOCX document package.',
      statusCode: 415,
    };
  }

  return { ok: true, ext, mimeType: expectedMimeType };
}

export async function storeFile(fileBuffer, originalName, mimeType) {
  const validation = validateDocument(originalName, mimeType, fileBuffer);
  if (!validation.ok) {
    throw new DocumentValidationError(validation.error, validation.statusCode);
  }

  const safeOriginal = sanitizeFilename(originalName);
  const storageKey = `${crypto.randomUUID()}${validation.ext}`;
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  const targetPath = path.join(UPLOAD_DIR, storageKey);

  await fs.promises.writeFile(targetPath, fileBuffer);

  return {
    storageKey,
    originalName: safeOriginal,
    mimeType: validation.mimeType,
    size: fileBuffer.length,
    uploadedAt: new Date(),
  };
}

export function getFileStream(storageKey) {
  // Prevent directory traversal attacks
  const safeKey = path.basename(storageKey);
  const filePath = path.join(UPLOAD_DIR, safeKey);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);
  return { stream, size: stat.size, filePath };
}

export async function deleteStoredFile(storageKey) {
  try {
    const safeKey = path.basename(storageKey);
    const filePath = path.join(UPLOAD_DIR, safeKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isValidDocx(buffer) {
  const archive = readZipEntries(buffer);
  if (!archive || DOCX_PARTS.some((part) => !archive.entries.has(part))) return false;
  const entries = archive.entries;
  const selectedSize = DOCX_PARTS.reduce(
    (total, part) => total + entries.get(part).uncompressedSize,
    0
  );
  if (selectedSize > MAX_FILE_SIZE) return false;

  const contentTypes = readZipEntry(
    buffer,
    entries.get('[Content_Types].xml'),
    archive.directoryOffset
  );
  const rootRelationships = readZipEntry(
    buffer,
    entries.get('_rels/.rels'),
    archive.directoryOffset
  );
  const document = readZipEntry(
    buffer,
    entries.get('word/document.xml'),
    archive.directoryOffset
  );
  if (!contentTypes || !rootRelationships || !document) return false;

  const contentXml = contentTypes.toString('utf8').replace(/<!--[\s\S]*?-->/g, '');
  const relationshipsXml = rootRelationships.toString('utf8').replace(/<!--[\s\S]*?-->/g, '');
  const documentXml = document.toString('utf8').replace(/<!--[\s\S]*?-->/g, '');

  const typesRoot = contentXml.match(/<Types\b[^>]*>/)?.[0] || '';
  const contentTypeOverrides = contentXml.match(/<Override\b[^>]*>/g) || [];
  const hasWordContentType =
    /\bxmlns\s*=\s*(["'])http:\/\/schemas\.openxmlformats\.org\/package\/2006\/content-types\1/.test(typesRoot) &&
    contentTypeOverrides.some((tag) =>
      /\bPartName\s*=\s*(["'])\/word\/document\.xml\1/.test(tag) &&
      /\bContentType\s*=\s*(["'])application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml\1/.test(tag)
    );

  const relationshipsRoot = relationshipsXml.match(/<Relationships\b[^>]*>/)?.[0] || '';
  const relationshipEntries = relationshipsXml.match(/<Relationship\b[^>]*>/g) || [];
  const hasOfficeDocumentRelationship =
    /\bxmlns\s*=\s*(["'])http:\/\/schemas\.openxmlformats\.org\/package\/2006\/relationships\1/.test(relationshipsRoot) &&
    relationshipEntries.some((tag) =>
      /\bType\s*=\s*(["'])http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/officeDocument\1/.test(tag) &&
      /\bTarget\s*=\s*(["'])word\/document\.xml\1/.test(tag)
    );

  const hasWordDocument =
    /<(?:[A-Za-z_][\w.-]*:)?document\b/.test(documentXml) &&
    /<(?:[A-Za-z_][\w.-]*:)?body\b/.test(documentXml) &&
    (documentXml.includes('http://schemas.openxmlformats.org/wordprocessingml/2006/main') ||
      documentXml.includes('http://purl.oclc.org/ooxml/wordprocessingml/main'));

  return hasWordContentType && hasOfficeDocumentRelationship && hasWordDocument;
}

function readZipEntries(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 22 - 0xffff);
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      const commentLength = buffer.readUInt16LE(offset + 20);
      if (offset + 22 + commentLength === buffer.length) {
        endOffset = offset;
        break;
      }
    }
  }
  if (endOffset < 0) return null;

  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDisk = buffer.readUInt16LE(endOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const directorySize = buffer.readUInt32LE(endOffset + 12);
  const directoryOffset = buffer.readUInt32LE(endOffset + 16);
  const directoryEnd = directoryOffset + directorySize;

  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff ||
    entryCount > 4096 ||
    directoryEnd > endOffset
  ) {
    return null;
  }

  const entries = new Map();
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > directoryEnd || buffer.readUInt32LE(offset) !== 0x02014b50) {
      return null;
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const startDisk = buffer.readUInt16LE(offset + 34);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const recordEnd = offset + 46 + nameLength + extraLength + commentLength;

    if (
      recordEnd > directoryEnd ||
      (flags & 1) !== 0 ||
      startDisk !== 0 ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset === 0xffffffff
    ) {
      return null;
    }

    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (entries.has(name)) return null;
    entries.set(name, {
      name,
      flags,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    offset = recordEnd;
  }

  return offset === directoryEnd ? { entries, directoryOffset } : null;
}

function readZipEntry(buffer, entry, directoryOffset) {
  if (
    !entry ||
    entry.uncompressedSize > MAX_FILE_SIZE ||
    entry.localOffset + 30 > directoryOffset
  ) {
    return null;
  }
  const offset = entry.localOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) return null;

  const localFlags = buffer.readUInt16LE(offset + 6);
  const localMethod = buffer.readUInt16LE(offset + 8);
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const nameStart = offset + 30;
  const dataStart = nameStart + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (
    localFlags !== entry.flags ||
    localMethod !== entry.method ||
    buffer.toString('utf8', nameStart, nameStart + nameLength) !== entry.name ||
    dataEnd > directoryOffset ||
    (entry.method !== 0 && entry.method !== 8)
  ) {
    return null;
  }

  try {
    const compressed = buffer.subarray(dataStart, dataEnd);
    const content = entry.method === 0
      ? compressed
      : inflateRawSync(compressed, { maxOutputLength: MAX_FILE_SIZE });
    if (
      content.length !== entry.uncompressedSize ||
      crc32(content) !== entry.crc
    ) {
      return null;
    }
    return content;
  } catch {
    return null;
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
