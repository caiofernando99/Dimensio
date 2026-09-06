import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
  onmessage: ((event: MessageEvent) => void) | null = null;
}
Object.defineProperty(window, 'BroadcastChannel', {
  value: MockBroadcastChannel,
  writable: true,
});

Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'jsdom-test',
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
      write: vi.fn().mockResolvedValue(undefined),
    },
  },
  writable: true,
});

Object.defineProperty(document, 'fonts', {
  value: { ready: Promise.resolve() },
  writable: true,
});

const mockCanvasContext = {
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: [] })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: [] })),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  canvas: { width: 0, height: 0 },
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  isPointInPath: vi.fn(),
  isPointInStroke: vi.fn(),
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  strokeStyle: '#000',
  fillStyle: '#000',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  direction: 'ltr',
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'low',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  shadowColor: 'rgba(0,0,0,0)',
  lineDashOffset: 0,
  transferFromImageBitmap: vi.fn(),
} as unknown as CanvasRenderingContext2D;

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvasContext as any);

global.URL = class URL {
  static createObjectURL() { return 'blob:mock'; }
  static revokeObjectURL() {}
  constructor(public href: string) {}
  protocol = '';
  host = '';
  hostname = '';
  port = '';
  pathname = '';
  search = '';
  hash = '';
  searchParams = new URLSearchParams();
  toString() { return this.href; }
  toJSON() { return this.href; }
} as any;