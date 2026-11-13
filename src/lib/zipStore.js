// Minimal ZIP writer: no compression ("store" method), no dependencies.
//
// Used by the records export so a trustee gets one tidy file. Written here
// instead of pulling in a package because every marae runs this same code, and
// a new dependency is a new way for one bad release to reach all of them.
//
// Limits (far above what a marae's records need): fewer than 65,535 files, and
// each file and the whole archive under 4 GB (no ZIP64).

const encoder = new TextEncoder();

let crcTable = null;
function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
}

export function crc32(bytes) {
  if (!crcTable) crcTable = makeCrcTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xFFFF, day: day & 0xFFFF };
}

/**
 * files: [{ name: 'folder/file.csv', data: string | Uint8Array }]
 * Returns a Uint8Array containing a valid .zip. Names are stored as UTF-8.
 */
export function createZip(files, date = new Date()) {
  if (files.length >= 0xFFFF) throw new Error('Too many files for a zip');
  const { time, day } = dosDateTime(date);
  const parts = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    if (data.length >= 0xFFFFFFFF) throw new Error('A file is too large for a zip');
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034B50, true);
    local.setUint16(4, 20, true);        // version needed
    local.setUint16(6, 0x0800, true);    // flag: names are UTF-8
    local.setUint16(8, 0, true);         // method: stored
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);        // extra length
    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014B50, true);
    entry.setUint16(4, 20, true);        // version made by
    entry.setUint16(6, 20, true);        // version needed
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, day, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint16(30, 0, true);        // extra length
    entry.setUint16(32, 0, true);        // comment length
    entry.setUint16(34, 0, true);        // disk number
    entry.setUint16(36, 0, true);        // internal attributes
    entry.setUint32(38, 0, true);        // external attributes
    entry.setUint32(42, offset, true);   // where this file starts
    central.push(new Uint8Array(entry.buffer), nameBytes);

    offset += 30 + nameBytes.length + data.length;
    if (offset >= 0xFFFFFFFF) throw new Error('Archive is too large for a zip');
  }

  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054B50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);

  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const total = all.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}
