/**
 * The key to the surprisal ramp.
 *
 * The colouring on the specimen is the best idea in the app and the first
 * thing that looks broken: faded letters scattered through a paragraph read as
 * a font that failed to load, not as an encoding. Its only explanation was a
 * sentence naming a coined term and a logarithm, which explains an unfamiliar
 * picture with two more unfamiliar things.
 *
 * A key fixes that by recognition rather than by reading. It is deliberately
 * the same gradient the characters are drawn from — the stops are the ramp
 * tokens — so the bar and the text cannot drift apart.
 *
 * The top of the ramp is rescaled to the alphabet, so the upper bound is a
 * prop rather than a constant: a four-symbol alphabet tops out at two bits and
 * a fixed key would be a lie about what is on screen.
 */

import './RampKey.css';

interface Props {
  /** Where the ramp tops out, in bits. */
  maxBits: number;
}

export function RampKey({ maxBits }: Props): JSX.Element {
  const top = maxBits > 0 ? maxBits : 1;
  return (
    <div className="rampkey">
      <span className="rampkey-end">predictable</span>
      <span
        className="rampkey-bar"
        role="img"
        aria-label={`Colour key: characters costing near zero bits are drawn in the page colour, characters costing ${top.toFixed(
          0,
        )} bits or more are drawn at full contrast.`}
      />
      <span className="rampkey-end">surprising</span>
      <span className="rampkey-scale data" aria-hidden="true">
        0—{top.toFixed(0)} bits
      </span>
    </div>
  );
}
