import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Tsumi — Anime Streaming';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Generated default social card with the Tsumi branding. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 20% 0%, #2a1a4a 0%, #0A0A0F 55%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ fontSize: 140, color: '#7C3AED' }}>罪</div>
          <div
            style={{
              fontSize: 180,
              fontWeight: 800,
              letterSpacing: 8,
              textShadow: '0 0 40px rgba(167,139,250,0.6)',
            }}
          >
            TSUMI
          </div>
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 36,
            color: '#A78BFA',
            letterSpacing: 6,
          }}
        >
          ANIME STREAMING
        </div>
        <div style={{ marginTop: 8, fontSize: 24, color: '#9ca3af' }}>
          Powered by live AniList data
        </div>
      </div>
    ),
    { ...size },
  );
}
