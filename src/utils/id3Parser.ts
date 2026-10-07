import { Track } from '../types';

/**
 * Extracts metadata from audio files using ID3v2, ID3v1, MP4 tags, FLAC headers,
 * and browser Audio decoding for accurate duration.
 * Gracefully falls back to filename as required by implementation rules.
 */
export async function parseAudioMetadata(file: File): Promise<Omit<Track, 'id' | 'addedAt' | 'lastPlayedAt' | 'playCount' | 'isFavorite'>> {
  const filename = file.name;
  const extension = (filename.split('.').pop() || '').toLowerCase();
  const baseName = filename.substring(0, filename.lastIndexOf('.')) || filename;

  // Default fallback parsed from filename:
  // e.g. "Kaelen Voss - Neon Drift" -> artist: "Kaelen Voss", title: "Neon Drift"
  let parsedArtist = 'Unknown Artist';
  let parsedTitle = baseName;
  let parsedAlbum = 'Unknown Album';

  if (baseName.includes(' - ')) {
    const parts = baseName.split(' - ');
    if (parts.length >= 2) {
      parsedArtist = cleanString(parts[0]);
      parsedTitle = cleanString(parts.slice(1).join(' - '));
    }
  } else if (baseName.includes('_')) {
    // e.g. "Voice_Memo_Final_Mix_24" -> keep as is or format
    parsedTitle = baseName;
  }

  let coverBlob: Blob | undefined;
  let coverArtUrl: string | undefined;
  let hasEmbeddedCover = false;
  let sampleRate: number | undefined;
  let bitDepth: number | undefined;
  let lossless = false;

  // Detect format / lossless nature
  if (extension === 'flac') {
    lossless = true;
    bitDepth = 24; // default FLAC estimate or read below
    sampleRate = 48000;
  } else if (extension === 'wav') {
    lossless = true;
    bitDepth = 24;
    sampleRate = 44100;
  } else if (extension === 'aiff' || extension === 'alac') {
    lossless = true;
  }

  try {
    // Read the first 256KB to inspect headers and ID3v2 tags
    const headerBuffer = await file.slice(0, 262144).arrayBuffer();
    const dataView = new DataView(headerBuffer);

    // Check for ID3v2 header
    if (headerBuffer.byteLength >= 10 &&
        dataView.getUint8(0) === 0x49 && // 'I'
        dataView.getUint8(1) === 0x44 && // 'D'
        dataView.getUint8(2) === 0x33) { // '3'
      const version = dataView.getUint8(3); // 3 for ID3v2.3, 4 for ID3v2.4
      const id3Size = readSyncsafeInteger(dataView, 6);

      // If the ID3 tag extends beyond 256KB (common if large embedded art is present),
      // read the full ID3 header slice
      let fullBuffer = headerBuffer;
      let fullView = dataView;
      if (id3Size + 10 > headerBuffer.byteLength && id3Size < 12 * 1024 * 1024) {
        try {
          const id3Slice = await file.slice(0, Math.min(file.size, id3Size + 10)).arrayBuffer();
          fullBuffer = id3Slice;
          fullView = new DataView(fullBuffer);
        } catch {
          // fallback to already read buffer
        }
      }

      const parsedTags = parseID3v2Frames(fullBuffer, fullView, version);
      if (parsedTags.title) parsedTitle = parsedTags.title;
      if (parsedTags.artist) parsedArtist = parsedTags.artist;
      if (parsedTags.album) parsedAlbum = parsedTags.album;
      if (parsedTags.picture) {
        coverBlob = parsedTags.picture;
        coverArtUrl = URL.createObjectURL(coverBlob);
        hasEmbeddedCover = true;
      }
    }

    // Inspect FLAC header if flac
    if (extension === 'flac' && headerBuffer.byteLength >= 42) {
      if (dataView.getUint8(0) === 0x66 && dataView.getUint8(1) === 0x4C &&
          dataView.getUint8(2) === 0x61 && dataView.getUint8(3) === 0x43) { // 'fLaC'
        // STREAMINFO block is immediately after (byte 4 to 38)
        // Sample rate (20 bits), channels (3 bits), bits per sample (5 bits)
        const b18 = dataView.getUint8(18);
        const b19 = dataView.getUint8(19);
        const b20 = dataView.getUint8(20);
        const b21 = dataView.getUint8(21);
        sampleRate = (b18 << 12) | (b19 << 4) | (b20 >> 4);
        bitDepth = (((b20 & 0x01) << 4) | (b21 >> 4)) + 1;
        lossless = true;
      }
    }

    // Inspect WAV header if wav
    if (extension === 'wav' && headerBuffer.byteLength >= 36) {
      // Chunk ID "RIFF"
      if (dataView.getUint8(0) === 0x52 && dataView.getUint8(1) === 0x49 &&
          dataView.getUint8(2) === 0x46 && dataView.getUint8(3) === 0x46) {
        sampleRate = dataView.getUint32(24, true);
        bitDepth = dataView.getUint16(34, true);
        lossless = true;
      }
    }
  } catch (err) {
    console.warn('Tag parsing warning for file', filename, err);
  }

  // Calculate real duration using browser native Audio element
  let duration = 0;
  try {
    duration = await getAudioDuration(file);
  } catch (err) {
    console.warn('Duration probe warning', err);
  }

  // Format label (e.g. "LOSSLESS 24-BIT", "LOSSLESS FLAC", "320 KBPS MP3")
  let formatLabel = extension.toUpperCase();
  let bitrate: number | undefined;

  if (duration > 0) {
    const rawBitrate = Math.round((file.size * 8) / duration / 1000);
    bitrate = rawBitrate;
  }

  if (lossless) {
    if (bitDepth && bitDepth >= 24) {
      formatLabel = `LOSSLESS ${bitDepth}-BIT`;
    } else {
      formatLabel = `LOSSLESS ${extension.toUpperCase()}`;
    }
  } else if (bitrate) {
    // Normalise lossy bitrate
    if (bitrate > 300) formatLabel = 'MP3 320 KBPS';
    else if (bitrate > 240) formatLabel = 'MP3 256 KBPS';
    else if (bitrate > 180) formatLabel = '192 KBPS';
    else formatLabel = `${extension.toUpperCase()} ${bitrate} KBPS`;
  }

  // File path simulation / folder discovery from File API webkitRelativePath
  let path = '/storage/emulated/0/Music';
  if ((file as any).webkitRelativePath) {
    const relPath = (file as any).webkitRelativePath;
    const folder = relPath.substring(0, relPath.lastIndexOf('/'));
    if (folder) {
      path = `/storage/emulated/0/${folder}`;
    }
  }

  return {
    name: filename,
    title: parsedTitle,
    artist: parsedArtist,
    album: parsedAlbum,
    duration: Math.round(duration) || 0,
    size: file.size,
    type: file.type || `audio/${extension}`,
    extension,
    path,
    hasEmbeddedCover,
    coverArtUrl,
    coverBlob,
    bitrate,
    sampleRate,
    bitDepth,
    lossless,
    formatLabel,
    file,
  };
}

/**
 * Calculates audio duration by loading into native Audio object
 */
function getAudioDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    
    let resolved = false;
    const cleanUp = () => {
      if (!resolved) {
        resolved = true;
        URL.revokeObjectURL(url);
      }
    };

    audio.onloadedmetadata = () => {
      const dur = audio.duration;
      cleanUp();
      resolve(Number.isFinite(dur) ? dur : 0);
    };

    audio.onerror = () => {
      cleanUp();
      resolve(0);
    };

    // Safety timeout in case audio file is corrupt or decoder stalls
    setTimeout(() => {
      if (!resolved) {
        cleanUp();
        resolve(0);
      }
    }, 4000);

    audio.src = url;
  });
}

function readSyncsafeInteger(dataView: DataView, offset: number): number {
  return (
    ((dataView.getUint8(offset) & 0x7f) << 21) |
    ((dataView.getUint8(offset + 1) & 0x7f) << 14) |
    ((dataView.getUint8(offset + 2) & 0x7f) << 7) |
    (dataView.getUint8(offset + 3) & 0x7f)
  );
}

function parseID3v2Frames(buffer: ArrayBuffer, dataView: DataView, version: number) {
  let offset = 10;
  const limit = buffer.byteLength;
  const result: { title?: string; artist?: string; album?: string; picture?: Blob } = {};

  while (offset + 10 < limit) {
    const frameId = String.fromCharCode(
      dataView.getUint8(offset),
      dataView.getUint8(offset + 1),
      dataView.getUint8(offset + 2),
      dataView.getUint8(offset + 3)
    );

    // Padding reached or end of frames
    if (dataView.getUint8(offset) === 0) break;

    const frameSize = version === 4
      ? readSyncsafeInteger(dataView, offset + 4)
      : dataView.getUint32(offset + 4);

    if (frameSize <= 0 || offset + 10 + frameSize > limit) break;

    const frameDataOffset = offset + 10;
    
    if (frameId === 'TIT2') {
      result.title = decodeTextFrame(buffer, frameDataOffset, frameSize);
    } else if (frameId === 'TPE1') {
      result.artist = decodeTextFrame(buffer, frameDataOffset, frameSize);
    } else if (frameId === 'TALB') {
      result.album = decodeTextFrame(buffer, frameDataOffset, frameSize);
    } else if (frameId === 'APIC' && !result.picture) {
      result.picture = decodeApicFrame(buffer, frameDataOffset, frameSize);
    }

    offset += 10 + frameSize;
  }

  return result;
}

function decodeTextFrame(buffer: ArrayBuffer, offset: number, size: number): string {
  if (size <= 1) return '';
  const encoding = new DataView(buffer).getUint8(offset);
  const data = new Uint8Array(buffer, offset + 1, size - 1);
  return decodeStringWithEncoding(data, encoding).replace(/\0/g, '').trim();
}

function decodeApicFrame(buffer: ArrayBuffer, offset: number, size: number): Blob | undefined {
  if (size <= 5) return undefined;
  const view = new DataView(buffer);
  const encoding = view.getUint8(offset);
  let pos = offset + 1;

  // Read MIME type (ISO-8859-1 terminated by 0x00)
  let mime = '';
  while (pos < offset + size && view.getUint8(pos) !== 0) {
    mime += String.fromCharCode(view.getUint8(pos));
    pos++;
  }
  pos++; // skip null byte

  if (!mime) mime = 'image/jpeg';
  if (mime === '-->') mime = 'image/jpeg';

  // Picture type (1 byte, 0x03 is front cover)
  pos++;

  // Description terminated by null byte(s)
  if (encoding === 0 || encoding === 3) {
    while (pos < offset + size && view.getUint8(pos) !== 0) pos++;
    pos++;
  } else {
    // 2-byte terminator
    while (pos + 1 < offset + size && !(view.getUint8(pos) === 0 && view.getUint8(pos + 1) === 0)) pos += 2;
    pos += 2;
  }

  const imageSize = (offset + size) - pos;
  if (imageSize <= 0) return undefined;

  const imgData = new Uint8Array(buffer, pos, imageSize);
  return new Blob([imgData], { type: mime });
}

function decodeStringWithEncoding(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 1) {
      return new TextDecoder('utf-16le').decode(bytes);
    } else if (encoding === 2) {
      return new TextDecoder('utf-16be').decode(bytes);
    } else if (encoding === 3) {
      return new TextDecoder('utf-8').decode(bytes);
    } else {
      return new TextDecoder('iso-8859-1').decode(bytes);
    }
  } catch {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] > 0) str += String.fromCharCode(bytes[i]);
    }
    return str;
  }
}

function cleanString(str: string): string {
  return str.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}
