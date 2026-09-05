/**
 * The measurements, as a file.
 *
 * The primary audience for this app arrives to check whether its numbers are
 * real. Every figure is on screen already, so this adds no information — what
 * it adds is the form checking actually takes, which is a column you can sort
 * and subtract rather than a table you retype.
 *
 * Every row names the rule that produced it. A number in a spreadsheet with no
 * provenance is exactly what this app exists not to produce, so the file
 * carries its own header: the text it describes, its length, the settings, and
 * the arbitrary choices that move the figures.
 *
 * Pure: it builds a string. The download belongs to the caller, because the
 * engine and its neighbours do not touch the DOM.
 */

import type { CoderResult, TextAnalysis } from '../engine/index.ts';
import { ALPHA } from '../engine/index.ts';
import type { Lz77Settings } from '../state/appState.ts';

export interface ExportInput {
  analysis: TextAnalysis;
  lz77Settings: Lz77Settings;
  results: {
    huffman: CoderResult;
    arithmetic: CoderResult;
    lz77: CoderResult;
  };
  /** Which sample it came from, or null when it is the reader's own text. */
  sampleId: string | null;
}

function cell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(values: Array<string | number>): string {
  return values.map(cell).join(',');
}

/**
 * The whole measurement as CSV.
 *
 * Two blocks: the staircase by order, then the three coders at the order they
 * were run at. Comment lines carry the provenance, and every one of the
 * arbitrary choices named in the interface is named here too — a file that
 * left them out would be less checkable than the screen it came from.
 */
export function measurementsCsv(input: ExportInput): string {
  const { analysis, results, lz77Settings, sampleId } = input;
  const lines: string[] = [];

  lines.push('# Compression Lab measurements');
  lines.push(`# text: ${sampleId === null ? 'pasted by the reader' : `bundled sample "${sampleId}"`}`);
  lines.push(`# characters: ${analysis.symbolCount}`);
  lines.push(`# distinct symbols: ${analysis.alphabet.length}`);
  lines.push(`# UTF-8 bytes: ${analysis.byteCount}`);
  lines.push(`# model: ${analysis.adaptive ? 'adaptive' : 'static'}`);
  lines.push(`# cheapest order: ${analysis.optimalOrder}`);
  lines.push('#');
  lines.push('# Arbitrary choices that move these numbers, all stated in the interface:');
  lines.push(`#   probabilities use add-constant smoothing, alpha = ${ALPHA},`);
  lines.push(`#     over the ${analysis.alphabet.length} symbols occurring in this text`);
  lines.push('#   entropy columns use the unsmoothed counts');
  lines.push("#   model description is the serialised model's byte length times eight,");
  lines.push("#     under the format documented in src/engine/modelcost.ts ('CLM1')");
  lines.push(
    `#   LZ77 tokens: literal = 1 + 8 bits; match = 1 + log2(window ${lz77Settings.windowSize})`,
  );
  lines.push(
    `#     + log2(look-ahead ${lz77Settings.lookahead}) bits; lazy matching ${
      lz77Settings.lazy ? 'on' : 'off'
    }`,
  );
  lines.push('#');

  lines.push('# The staircase, by model order. All figures in bits per symbol.');
  lines.push(
    row(['section', 'order', 'contexts', 'entropy', 'code_stream', 'model_description', 'total']),
  );
  for (const r of analysis.rows) {
    lines.push(
      row([
        'staircase',
        r.order,
        r.contexts,
        r.entropyBits.toFixed(6),
        r.codeBits.toFixed(6),
        r.modelBits.toFixed(6),
        r.totalBits.toFixed(6),
      ]),
    );
  }

  lines.push('');
  lines.push('# The three coders, as run. Bits are totals, not per symbol.');
  lines.push(
    row([
      'section',
      'coder',
      'order',
      'code_stream_bits',
      'model_bits',
      'total_bits',
      'bits_per_symbol',
      'of_utf8_original',
    ]),
  );
  for (const [name, result] of Object.entries(results)) {
    lines.push(
      row([
        'coder',
        name,
        result.order === null ? 'n/a' : result.order,
        result.codeBits,
        result.modelBits,
        result.totalBits,
        result.bitsPerSymbol.toFixed(6),
        (result.totalBits / (analysis.byteCount * 8 || 1)).toFixed(6),
      ]),
    );
  }

  return `${lines.join('\n')}\n`;
}

/** A filename that says what the file is and what it measured. */
export function measurementsFilename(sampleId: string | null): string {
  return `compression-lab-${sampleId ?? 'your-text'}.csv`;
}
