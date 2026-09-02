/**
 * Bit-level writer and reader over a byte buffer.
 *
 * Bits are packed most-significant-bit first within each byte, so a stream
 * written as 1,0,1 begins with the byte 0b10100000. MSB-first is the
 * convention Huffman code strings are written in, and keeping one convention
 * everywhere means a code string read left to right is the same order the
 * decoder consumes it.
 */

export class BitWriter {
  private bytes: number[] = [];
  private current = 0;
  /** Number of bits already placed in `current`, 0..7. */
  private filled = 0;
  private count = 0;

  /** Total bits written so far. This is the app's unit of size. */
  get length(): number {
    return this.count;
  }

  writeBit(bit: 0 | 1 | boolean | number): void {
    const b = bit ? 1 : 0;
    this.current = (this.current << 1) | b;
    this.filled += 1;
    this.count += 1;
    if (this.filled === 8) {
      this.bytes.push(this.current & 0xff);
      this.current = 0;
      this.filled = 0;
    }
  }

  /** Write the low `width` bits of `value`, most significant first. */
  writeBits(value: number, width: number): void {
    for (let i = width - 1; i >= 0; i--) {
      this.writeBit((value >>> i) & 1);
    }
  }

  /** Write a string of '0' and '1' characters. */
  writeString(bits: string): void {
    for (let i = 0; i < bits.length; i++) {
      this.writeBit(bits.charCodeAt(i) === 49 ? 1 : 0);
    }
  }

  /**
   * Pad to a byte boundary with zeroes and return the bytes.
   * The padding is not counted in `length` — reported sizes are exact bit
   * counts, because rounding every measurement up to a byte would hide the
   * differences this app exists to show.
   */
  finish(): Uint8Array {
    const out = this.bytes.slice();
    if (this.filled > 0) {
      out.push((this.current << (8 - this.filled)) & 0xff);
    }
    return Uint8Array.from(out);
  }
}

export class BitReader {
  private pos = 0;

  constructor(private readonly bytes: Uint8Array) {}

  /** Bits consumed so far. */
  get position(): number {
    return this.pos;
  }

  get exhausted(): boolean {
    return this.pos >= this.bytes.length * 8;
  }

  /** Reads past the end return 0, which lets the arithmetic decoder flush. */
  readBit(): 0 | 1 {
    const byte = this.bytes[this.pos >>> 3];
    if (byte === undefined) {
      this.pos += 1;
      return 0;
    }
    const bit = (byte >>> (7 - (this.pos & 7))) & 1;
    this.pos += 1;
    return bit as 0 | 1;
  }

  readBits(width: number): number {
    let value = 0;
    for (let i = 0; i < width; i++) {
      value = value * 2 + this.readBit();
    }
    return value;
  }
}

/** Bits needed to hold values 0..n-1. `bitsFor(1)` is 0: one value needs no bits. */
export function bitsFor(n: number): number {
  if (n <= 1) return 0;
  return Math.ceil(Math.log2(n));
}
