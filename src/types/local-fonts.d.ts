// Local Font Access API (Chromium desktop, secure contexts). Not yet in TypeScript's lib.dom.
interface FontData {
  readonly family: string;
  readonly fullName: string;
  readonly postscriptName: string;
  readonly style: string;
  blob(): Promise<Blob>;
}

interface Window {
  queryLocalFonts?: (options?: { postscriptNames?: string[] }) => Promise<FontData[]>;
}
