import type { CSSProperties } from 'react';

export function MotionHeading({
  text,
  id,
  className = '',
}: {
  text: string;
  id?: string;
  className?: string;
}) {
  const words = text.split(/\s+/);

  return (
    <h2 id={id} aria-label={text} className={`motion-heading ${className}`}>
      {words.map((word, index) => (
        <span className="motion-heading__clip" key={`${word}-${index}`}>
          <span
            className="motion-heading__word"
            style={{ '--word-index': index } as CSSProperties}
          >
            {word}
          </span>
          {index < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </h2>
  );
}
