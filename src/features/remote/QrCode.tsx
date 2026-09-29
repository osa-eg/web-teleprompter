import { useMemo } from 'react';
import { encode } from 'uqr';

interface QrCodeProps {
  value: string;
  label: string;
  size?: number;
}

/** QR code drawn as one SVG path (dark modules on white, with the standard quiet zone). */
export function QrCode({ value, label, size = 232 }: QrCodeProps) {
  const { path, count } = useMemo(() => {
    const { data } = encode(value, { ecc: 'M', border: 4 });
    let d = '';
    data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { path: d, count: data.length };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      shapeRendering="crispEdges"
      data-testid="remote-qr"
    >
      <rect width={count} height={count} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
