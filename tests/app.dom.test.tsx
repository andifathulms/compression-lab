// @vitest-environment jsdom
/**
 * The app in a real DOM, doing the things a visitor does.
 *
 * `smoke.test.tsx` renders to a string, which cannot run an effect. This one
 * runs the layout effects, the resize observer and the imperative tint write,
 * which is where the interesting mistakes are: the surface writes its colours
 * onto the DOM by hand rather than through React, and nothing else would catch
 * that going wrong.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App.tsx';

beforeAll(() => {
  // jsdom has neither, and the surface measures itself with one.
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  // The app writes its settings into the URL, and jsdom keeps one window for
  // the whole file, so without this each test would start from the last one's
  // state. That it matters at all is the URL serialisation working.
  window.history.replaceState(null, '', '/');
});

afterEach(cleanup);

describe('the app in a browser', () => {
  it('tints every character by its cost, straight onto the DOM', () => {
    const { container } = render(<App />);
    const spans = container.querySelectorAll<HTMLElement>('.ts-layer [data-i]');
    expect(spans.length).toBeGreaterThan(1000);
    const colours = new Set<string>();
    for (const span of spans) {
      expect(span.style.color, `character ${span.dataset.i} was left untinted`).not.toBe('');
      colours.add(span.style.color);
    }
    // A ramp, not a flat fill: prose spans a good part of it.
    expect(colours.size).toBeGreaterThan(20);
  });

  it('re-tints when the model order changes', () => {
    const { container } = render(<App />);
    const before = Array.from(
      container.querySelectorAll<HTMLElement>('.ts-layer [data-i]'),
    ).map((s) => s.style.color);

    // A continuous control: the change is applied on the frame, not queued.
    fireEvent.change(document.getElementById('order')!, { target: { value: '4' } });

    const after = Array.from(
      container.querySelectorAll<HTMLElement>('.ts-layer [data-i]'),
    ).map((s) => s.style.color);
    expect(after.length).toBe(before.length);
    expect(after.join('|')).not.toBe(before.join('|'));
  });

  it('shows the staircase minimum, and moves it when the text gets shorter', async () => {
    render(<App />);
    expect(await screen.findByText(/lowest total for this text/i)).toBeTruthy();
    const headline = document.querySelector('.stair-headline .display');
    expect(headline?.textContent).toBe('order 1');

    const surface = screen.getByLabelText(/the text being measured/i) as HTMLTextAreaElement;
    const user = userEvent.setup();
    await user.clear(surface);
    await user.type(surface, 'the cat sat on the mat. the cat sat on the mat.');

    // A short text cannot pay for a bigger model, so the minimum falls back.
    expect(document.querySelector('.stair-headline .display')?.textContent).toBe('order 0');
  }, 20000);

  it('switches instruments without disturbing the staircase or the text', async () => {
    render(<App />);
    const user = userEvent.setup();
    const before = document.querySelector('.stair-headline')?.textContent;

    await user.click(screen.getByRole('button', { name: 'Arithmetic' }));
    expect(screen.getByRole('heading', { name: /arithmetic coding/i })).toBeTruthy();
    expect(screen.getByText(/idealised real-number interval/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'LZ77' }));
    expect(screen.getByRole('heading', { name: 'LZ77' })).toBeTruthy();
    expect(screen.getByLabelText(/^window/i)).toBeTruthy();

    expect(document.querySelector('.stair-headline')?.textContent).toBe(before);
  }, 20000);

  it('marks every occurrence of a symbol picked out of the Huffman tree', async () => {
    const { container } = render(<App />);
    const user = userEvent.setup();
    const table = container.querySelector('.ht-table')!;
    const buttons = within(table as HTMLElement).getAllByRole('button');
    await user.click(buttons[0]);
    expect(container.querySelectorAll('.ts-symbol').length).toBeGreaterThan(0);
  }, 20000);

  it('refuses a paste over the cap instead of truncating it', async () => {
    render(<App />);
    const surface = screen.getByLabelText(/the text being measured/i) as HTMLTextAreaElement;
    const user = userEvent.setup();
    surface.focus();
    await user.paste('x'.repeat(200_001));
    expect(screen.getByRole('alert').textContent).toMatch(/was not truncated/i);
  }, 20000);

  it('keeps typed text out of the URL', async () => {
    render(<App />);
    const user = userEvent.setup();
    const surface = screen.getByLabelText(/the text being measured/i) as HTMLTextAreaElement;
    await user.clear(surface);
    await user.type(surface, 'something private');
    expect(window.location.search).not.toContain('private');
    expect(window.location.search).toContain('order=');
  }, 20000);
});
