// Minimal ambient declaration — WebTorrent ships no bundled types and the
// community @types package lags the v2 browser API. We use it loosely (any)
// inside the player, so a module shim is sufficient.
declare module 'webtorrent';
