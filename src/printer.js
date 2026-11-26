/**
 * Printer thermal 58mm via Web Bluetooth (ESC/POS).
 * Service UUID umum printer thermal: 0x18F0, 0xFF00, 0xFFE0, 0xFEE7, 0x1101.
 */

const SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb',
];

const state = { device: null, characteristic: null, name: '' };
const listeners = new Set();

export const isBluetoothSupported = () => typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);

export function printerStatus() {
  return { connected: Boolean(state.characteristic), name: state.name };
}

export function onPrinterChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  const status = printerStatus();
  listeners.forEach((fn) => fn(status));
}

export async function connectPrinter() {
  if (!isBluetoothSupported()) {
    throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome di Android/desktop, atau cetak lewat dialog.');
  }
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICES,
  });

  state.device = device;
  state.name = device.name || 'Printer Bluetooth';
  device.addEventListener('gattserverdisconnected', () => {
    state.characteristic = null;
    emit();
  });

  const server = await device.gatt.connect();
  let characteristic = null;
  for (const uuid of SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      characteristic =
        chars.find((c) => c.properties.writeWithoutResponse) ||
        chars.find((c) => c.properties.write) ||
        null;
      if (characteristic) break;
    } catch {
      /* layanan tidak tersedia, lanjut ke berikutnya */
    }
  }
  if (!characteristic) {
    try {
      device.gatt.disconnect();
    } catch {}
    state.device = null;
    state.name = '';
    throw new Error('Printer terhubung tetapi tidak punya kanal tulis ESC/POS. Coba printer lain.');
  }
  state.characteristic = characteristic;
  emit();
  return printerStatus();
}

export function disconnectPrinter() {
  try {
    state.device?.gatt?.disconnect();
  } catch {}
  state.characteristic = null;
  state.name = '';
  emit();
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Ubah baris struk menjadi byte ESC/POS 58mm. */
export function encodeEscPos(rows) {
  const bytes = [];
  const put = (...b) => bytes.push(...b);
  const text = (value) => {
    for (const ch of String(value)) {
      const code = ch.charCodeAt(0);
      put(code < 128 ? code : 63); // fallback '?' untuk karakter non-ASCII
    }
  };

  put(ESC, 0x40); // init
  put(ESC, 0x61, 0x00); // left align
  put(ESC, 0x4d, 0x00); // font A

  for (const row of rows) {
    if (row.align === 'center') put(ESC, 0x61, 0x01);
    else put(ESC, 0x61, 0x00);

    if (row.bold) put(ESC, 0x45, 0x01);
    if (row.size === 'double') {
      put(GS, 0x21, 0x11); // double width + height
    } else {
      put(GS, 0x21, 0x00);
    }

    text(row.text);
    put(LF);

    if (row.size === 'double' || row.bold) {
      put(GS, 0x21, 0x00);
      put(ESC, 0x45, 0x00);
    }
  }

  put(LF, LF, LF);
  put(GS, 0x56, 0x42, 0x00); // partial cut
  return new Uint8Array(bytes);
}

export async function printRows(rows) {
  if (!state.characteristic) throw new Error('Printer Bluetooth belum terhubung.');
  const data = encodeEscPos(rows);
  const chunkSize = 120;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (state.characteristic.properties.writeWithoutResponse) {
      await state.characteristic.writeValueWithoutResponse(chunk);
    } else {
      await state.characteristic.writeValue(chunk);
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** Halaman uji cetak: garis, teks rata tengah, dan potong kertas. */
export function testPrintRows() {
  return [
    { text: 'UJI CETAK PRINTER', align: 'center', bold: true, size: 'double' },
    { text: 'Batagor Sagaya · 58mm', align: 'center' },
    { text: '--------------------------------', align: 'left' },
    { text: '12345678901234567890123456789012', align: 'left' },
    { text: 'Printer siap digunakan untuk struk.', align: 'left' },
    { text: '--------------------------------', align: 'left' },
    { text: 'Terima kasih', align: 'center' },
  ];
}
