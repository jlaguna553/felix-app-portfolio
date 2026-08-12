/**
 * Web Bluetooth wrapper for BLE thermal printers.
 *
 * Auto-connect strategy (in priority order):
 *   1. In-memory device cache  — fastest; survives within the same page session
 *   2. navigator.bluetooth.getDevices() — Chrome 85+; survives page reload
 *   3. requestDevice() picker — one-time; user must select the printer
 *
 * After any successful pairing or print the device is cached in memory so
 * subsequent prints in the same session require no dialog at all.
 */

// Web Bluetooth types are not in standard lib.dom — define minimal shapes here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BluetoothDevice                   = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BluetoothRemoteGATTCharacteristic = any

interface BluetoothAPI {
  requestDevice(options: object): Promise<BluetoothDevice>
  getDevices(): Promise<BluetoothDevice[]>
}

function btAPI(): BluetoothAPI {
  return (navigator as unknown as { bluetooth: BluetoothAPI }).bluetooth
}

const LS_NAME = 'bt_printer_name'
const LS_ID   = 'bt_printer_id'

// Known BLE service/characteristic pairs for thermal printers (tried in order)
export const KNOWN_SERVICES: { service: string; write: string }[] = [
  // Generic BLE printer (very common in OFICHIDO / cheap Chinese printers)
  { service: '000018f0-0000-1000-8000-00805f9b34fb', write: '00002af1-0000-1000-8000-00805f9b34fb' },
  // Nordic UART Service (NUS)
  { service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', write: '6e400002-b5a3-f393-e0a9-e50e24dcca9e' },
  // Xprinter / iDPRT
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', write: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
  // ISSC BLE UART
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', write: '49535343-1e4d-4bd9-ba61-23c647249616' },
]

export const ALL_SERVICE_UUIDS = KNOWN_SERVICES.map(s => s.service)

// ── Session cache ─────────────────────────────────────────────────────────────
// Keeps the device object alive for the whole browser session so we never
// need to show the picker again after the first pairing.
let _cachedDevice: BluetoothDevice | null = null

function cacheDevice(device: BluetoothDevice) {
  _cachedDevice = device
}

// Last error message — readable by UI for helpful diagnostics
let _lastError = ''
export function getLastBTError(): string { return _lastError }

// ── Public helpers ────────────────────────────────────────────────────────────

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export function getPairedPrinterName(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(LS_NAME)
}

export function clearPairedPrinter() {
  _cachedDevice = null
  localStorage.removeItem(LS_NAME)
  localStorage.removeItem(LS_ID)
}

/**
 * Open the Bluetooth device picker. Caches the device for the session and
 * saves name/id to localStorage. Returns { name, device } or null on cancel.
 *
 * Strategy:
 *   1. Try filters by each known service UUID — on Android Chrome this triggers
 *      an active BLE scan that finds the printer even if it's not in the
 *      system "paired" list. acceptAllDevices alone can miss BLE-only devices.
 *   2. If all service filters fail (printer uses an unknown UUID or is not
 *      advertising), fall back to acceptAllDevices so the user can still
 *      find and select it manually.
 */
export async function pairPrinter(): Promise<{ name: string; device: BluetoothDevice } | null> {
  if (!isBluetoothSupported()) return null

  // Build filters: one entry per known service so Chrome scans for each
  const serviceFilters = KNOWN_SERVICES.map(s => ({ services: [s.service] }))

  // Also try common printer name prefixes (some printers don't advertise service UUID)
  const nameFilters = [
    'Printer', 'printer', 'POS', 'BT', 'RPP', 'MTP', 'HM', 'Xprinter',
    'OFICHIDO', 'BlueTooth', 'QS',
  ].map(prefix => ({ namePrefix: prefix }))

  const allFilters = [...serviceFilters, ...nameFilters]

  // Try with specific filters first
  try {
    const device = await btAPI().requestDevice({
      filters:          allFilters,
      optionalServices: ALL_SERVICE_UUIDS,
    })
    return saveAndCache(device)
  } catch (e: unknown) {
    // User cancelled (NotFoundError / AbortError) → don't fall through
    const name = (e as Error)?.name
    if (name === 'NotFoundError' || name === 'AbortError') return null
    // Any other error (e.g. filters not supported) → try acceptAllDevices
    console.warn('[BT Printer] Filtered scan failed, falling back:', e)
  }

  // Fallback: show all devices (user picks manually)
  try {
    const device = await btAPI().requestDevice({
      acceptAllDevices: true,
      optionalServices: ALL_SERVICE_UUIDS,
    })
    return saveAndCache(device)
  } catch {
    return null
  }
}

function saveAndCache(device: BluetoothDevice): { name: string; device: BluetoothDevice } {
  const name = device.name ?? 'Impresora BT'
  localStorage.setItem(LS_NAME, name)
  localStorage.setItem(LS_ID,   device.id ?? '')
  cacheDevice(device)
  return { name, device }
}

// ── Platform detection ────────────────────────────────────────────────────────

/**
 * Android Chrome enforces the default BLE MTU of 23 bytes (20 usable).
 * Desktop Chrome negotiates a higher MTU automatically.
 *
 * Chunk sizes:
 *   Android  → 20 bytes  (safe for any MTU, no negotiation needed)
 *   Desktop  → 100 bytes (Chrome auto-negotiates MTU ≥ 103 on Windows/Mac)
 *
 * Settle time after GATT connect:
 *   Android needs ~300 ms before service discovery is reliable.
 */
function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * GATT connect with platform-specific retry strategy.
 *
 * Android specifics:
 *   1. After requestDevice() the Android BT stack needs ~1.5 s to complete the
 *      Classic BT bond before the BLE GATT layer is ready ("Connection attempt
 *      failed" is the symptom when we connect too soon).
 *   2. If the printer was last used via Classic BT SPP (e.g. POS Printer app),
 *      call disconnect() before each retry to clear stale GATT state.
 *   3. After a successful connect, wait 300 ms before service discovery.
 *   4. More retries (4) with longer gaps (3 s) because Android BLE is slower.
 *
 * Windows:
 *   3 retries, 1 s between (first attempt after requestDevice often fails).
 */
async function gattConnect(device: BluetoothDevice) {
  if (device.gatt?.connected) return device.gatt

  const android = isAndroid()
  const MAX     = android ? 4 : 3
  const DELAY   = android ? 3000 : 1000

  // Android: wait for the OS bond to settle before attempting GATT connection.
  // Skipping this causes "Connection attempt failed" right after pairing.
  if (android) {
    console.log('[BT Printer] Android: waiting 1.5 s for BT bond to settle…')
    await delay(1500)
  }

  let lastErr: unknown
  for (let i = 1; i <= MAX; i++) {
    // On retry: forcefully disconnect any stale GATT session first.
    // This is especially needed on Android when the printer was previously
    // connected via Classic BT SPP (the BLE stack can be in an inconsistent state).
    if (i > 1) {
      try { device.gatt?.disconnect() } catch { /* ignore */ }
      await delay(android ? 1000 : 500)
    }

    try {
      console.log(`[BT Printer] GATT connect attempt ${i}/${MAX}${android ? ' (Android)' : ''}`)
      const server = await device.gatt!.connect()
      // Android: give the GATT server time to enumerate services
      if (android) await delay(400)
      return server
    } catch (err) {
      lastErr = err
      console.warn(`[BT Printer] Attempt ${i} failed:`, (err as Error)?.message ?? err)
      if (i < MAX) await delay(DELAY)
    }
  }
  throw lastErr
}

/**
 * Write a chunk, falling back from writeValueWithoutResponse to writeValue.
 * On Android, writeValueWithoutResponse may not be supported by the characteristic,
 * so the fallback to writeValue (with GATT ACK) is the reliable path.
 */
async function writeChunk(char: BluetoothRemoteGATTCharacteristic, chunk: Uint8Array) {
  try {
    await char.writeValueWithoutResponse(chunk)
  } catch {
    await char.writeValue(chunk)
  }
}

/** Core: connect to `device`, discover service, send `data`. */
async function connectAndPrint(device: BluetoothDevice, data: Uint8Array): Promise<boolean> {
  const android = isAndroid()
  console.log('[BT Printer] Connecting to:', device.name, android ? '(Android)' : '')
  const server = await gattConnect(device)
  console.log('[BT Printer] GATT connected')

  let writeChar: BluetoothRemoteGATTCharacteristic | null = null
  let foundService = ''
  for (const { service: svcUUID, write: writeUUID } of KNOWN_SERVICES) {
    try {
      const svc = await server.getPrimaryService(svcUUID)
      writeChar  = await svc.getCharacteristic(writeUUID)
      foundService = svcUUID
      console.log('[BT Printer] Service found:', svcUUID)
      break
    } catch { /* try next */ }
  }

  if (!writeChar) {
    _lastError = 'No se reconoció el servicio BLE. Modelo no soportado.'
    console.warn('[BT Printer]', _lastError)
    server.disconnect()
    return false
  }

  /**
   * Chunk size:
   *   - Android default BLE MTU = 23 bytes → 20 bytes usable (header = 3 bytes).
   *     Sending more than 20 bytes causes writeValue to reject on Android.
   *   - Desktop: Chrome auto-negotiates MTU; 100-byte chunks work fine.
   */
  const CHUNK       = android ? 20  : 100
  const CHUNK_DELAY = android ? 50  : 30   // ms between chunks

  console.log('[BT Printer] Writing', data.length, 'bytes →', foundService,
              `(${CHUNK}-byte chunks, ${CHUNK_DELAY}ms delay)`)

  for (let i = 0; i < data.length; i += CHUNK) {
    await writeChunk(writeChar, data.slice(i, i + CHUNK))
    await new Promise(r => setTimeout(r, CHUNK_DELAY))
  }
  server.disconnect()
  console.log('[BT Printer] Done ✓')
  return true
}

// ── Public print API ──────────────────────────────────────────────────────────

/**
 * Send data to the paired printer using the best available reconnect method:
 *   1. In-memory cached device (no API call)
 *   2. getDevices() — Chrome 85+
 *
 * Returns true on success.
 * Returns false with getLastBTError() set to:
 *   'getDevices_unsupported' — browser too old / API unavailable
 *   'getDevices_empty'       — no previously granted device found
 *   or a descriptive error string for other failures.
 *
 * When this returns false with one of the sentinel errors, call
 * pairPrinter() + printViaPickedDevice() as fallback (requires user gesture).
 */
export async function printViaBluetooth(data: Uint8Array): Promise<boolean> {
  _lastError = ''
  if (!isBluetoothSupported()) {
    _lastError = 'Bluetooth no soportado en este navegador'
    return false
  }

  // ── 1. In-memory cache (fastest path) ──────────────────────────────────────
  if (_cachedDevice) {
    try {
      const ok = await connectAndPrint(_cachedDevice, data)
      if (ok) return true
      // connectAndPrint failed but didn't throw — clear stale cache and fall through
    } catch {
      console.warn('[BT Printer] Cached device failed, clearing cache')
    }
    _cachedDevice = null
    _lastError = ''
  }

  // ── 2. getDevices() — Chrome 85+ ───────────────────────────────────────────
  if (typeof btAPI().getDevices !== 'function') {
    _lastError = 'getDevices_unsupported'
    console.warn('[BT Printer] getDevices() not available in this browser/version')
    return false
  }

  try {
    const devices: BluetoothDevice[] = await btAPI().getDevices()
    console.log('[BT Printer] getDevices() →', devices.map(d => d.name))

    const savedId = localStorage.getItem(LS_ID)
    const device  = savedId
      ? (devices.find(d => d.id === savedId) ?? devices[0])
      : devices[0]

    if (!device) {
      _lastError = 'getDevices_empty'
      console.warn('[BT Printer] No previously granted device found')
      return false
    }

    const ok = await connectAndPrint(device, data)
    if (ok) cacheDevice(device)   // cache for the rest of the session
    return ok
  } catch (err) {
    _lastError = err instanceof Error ? err.message : String(err)
    console.warn('[BT Printer] Error:', _lastError)
    return false
  }
}

/**
 * Pre-warm the device cache using getDevices() (Chrome 85+, no user gesture).
 * Call this early (e.g. when the print modal opens) so the first print in a
 * session can skip the picker entirely.
 * Safe to call multiple times — exits immediately if already cached.
 */
export async function warmDeviceCache(): Promise<void> {
  if (_cachedDevice) return
  if (!isBluetoothSupported() || !getPairedPrinterName()) return
  if (typeof btAPI().getDevices !== 'function') return
  try {
    const devices: BluetoothDevice[] = await btAPI().getDevices()
    const savedId = localStorage.getItem(LS_ID)
    const device  = savedId
      ? (devices.find(d => d.id === savedId) ?? devices[0])
      : devices[0]
    if (device) {
      cacheDevice(device)
      console.log('[BT Printer] Cache warmed (getDevices):', device.name)
    }
  } catch { /* silent — picker fallback still works */ }
}

/**
 * Print using a device object already obtained via pairPrinter().
 * Caches the device for the session on success.
 */
export async function printViaPickedDevice(device: BluetoothDevice, data: Uint8Array): Promise<boolean> {
  _lastError = ''
  try {
    const ok = await connectAndPrint(device, data)
    if (ok) cacheDevice(device)   // cache so next print needs no picker
    return ok
  } catch (err) {
    _lastError = err instanceof Error ? err.message : String(err)
    console.warn('[BT Printer] Error:', _lastError)
    return false
  }
}
