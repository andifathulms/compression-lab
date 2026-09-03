/**
 * The mark.
 *
 * Conditional entropy stepping down as the model conditions on more of the
 * text, with one riser in gold and a dot under it at the order that wins. It
 * is the staircase — the same figure the app's central instrument draws, at
 * eighteen pixels — so it is not a logo bolted onto the page so much as the
 * plot's own silhouette.
 *
 * Drawn rather than imported, and in the app's own tokens: the steps take the
 * ink of whichever ground is current, and the gold riser takes --model-cost,
 * which is the token the size split already uses for the model description.
 * That keeps the one rule the palette has — gold means the model — true in the
 * masthead as well as in the chart.
 *
 * No tile behind it. Radius in this app means "a pointer touches this", and
 * nothing here does.
 */

interface Props {
  /** Rendered edge, in pixels. The art is on a 100-unit grid. */
  size?: number;
}

export function Mark({ size = 18 }: Props): JSX.Element {
  return (
    <svg
      className="mark"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M13 25 H33 V44 H51 V58 H67 V68 H87"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="square"
      />
      <path
        d="M33 25 V44"
        fill="none"
        stroke="var(--model-cost)"
        strokeWidth="9"
        strokeLinecap="square"
      />
      <circle cx="33" cy="82" r="6.5" fill="var(--model-cost)" />
    </svg>
  );
}
