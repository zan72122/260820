/**
 * Session persistence. A reload, a rotation or a lost GL context should never
 * cost the child their fruit: the state machine and the ripening mask are both
 * plain arrays, so both are stored verbatim.
 */
import type { GameState } from './state'

const KEY = 'momo.session.v1'

export interface Snapshot {
  v: 1
  state: GameState
  /** Base64 of the blush mask bytes. */
  mask: string
  maskW: number
  maskH: number
}

function bytesToB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
  }
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function saveSnapshot(state: GameState, mask: Float32Array, w: number, h: number): void {
  try {
    const bytes = new Uint8Array(mask.length)
    for (let i = 0; i < mask.length; i++) bytes[i] = Math.max(0, Math.min(255, Math.round(mask[i] * 255)))
    const snap: Snapshot = { v: 1, state, mask: bytesToB64(bytes), maskW: w, maskH: h }
    sessionStorage.setItem(KEY, JSON.stringify(snap))
  } catch {
    /* private mode / quota - the game still works, it just forgets */
  }
}

export function loadSnapshot(): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const snap = JSON.parse(raw) as Snapshot
    if (!snap || snap.v !== 1 || !snap.state) return null
    return snap
  } catch {
    return null
  }
}

export function snapshotMask(snap: Snapshot, into: Float32Array, w: number, h: number): boolean {
  if (snap.maskW !== w || snap.maskH !== h) return false
  const bytes = b64ToBytes(snap.mask)
  if (bytes.length !== into.length) return false
  for (let i = 0; i < into.length; i++) into[i] = bytes[i] / 255
  return true
}
