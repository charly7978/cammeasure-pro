import { detectContours } from '@/lib/imageProcessing';

// @ts-ignore
importScripts('https://docs.opencv.org/4.x/opencv.js');

interface DetectMessage {
  type: 'DETECT';
  imageData: ImageData;
  minArea: number;
}

interface InitMessage {
  type: 'INIT';
}

declare const cv: any;

type Incoming = DetectMessage | InitMessage;

type Outgoing =
  | { type: 'READY' }
  | { type: 'DETECTED'; rects: any[] };

let isReady = false;

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const msg = event.data;

  if (msg.type === 'INIT') {
    // Wait for OpenCV WASM to be ready
    // cv['onRuntimeInitialized'] is triggered when module ready
    if (typeof cv !== 'undefined') {
      if (cv.getBuildInformation) {
        isReady = true;
        postMessage({ type: 'READY' } as Outgoing);
      } else {
        cv['onRuntimeInitialized'] = () => {
          isReady = true;
          postMessage({ type: 'READY' } as Outgoing);
        };
      }
    }
    return;
  }

  if (!isReady) return;

  if (msg.type === 'DETECT') {
    try {
      const { rects } = detectContours(cv, msg.imageData, msg.minArea);
      postMessage({ type: 'DETECTED', rects } as Outgoing);
    } catch (e) {
      console.error('Worker error', e);
    }
  }
};
