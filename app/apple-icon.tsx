import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 180, height: 180 };

/** Generated Apple touch icon — same branding, larger. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 30% 20%, #2a1a4a 0%, #0A0A0F 70%)',
          color: '#A78BFA',
          fontSize: 132,
          fontWeight: 700,
          fontFamily: 'sans-serif',
          textShadow: '0 0 40px rgba(167, 139, 250, 0.6)',
        }}
      >
        罪
      </div>
    ),
    { ...size },
  );
}
