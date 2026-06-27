import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 32, height: 32 };

/** Generated favicon: the 罪 character on Tsumi's brand purple. */
export default function Icon() {
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
            'linear-gradient(135deg, #1E1E2E 0%, #0A0A0F 100%)',
          color: '#A78BFA',
          fontSize: 24,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        罪
      </div>
    ),
    { ...size },
  );
}
