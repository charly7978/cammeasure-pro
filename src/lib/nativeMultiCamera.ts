import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

export type StereoFramePayload = {
  width: number; height: number;
  left: number[]; right: number[]; // RGBA Uint8
};

const isNative = Capacitor.getPlatform() !== 'web';

interface MultiCameraPlugin {
  listCameras(): Promise<{ devices: Array<{ id: string; isBack: boolean; physicalIds?: string[] }> }>;
  startStereo(options: { leftId: string; rightId: string; width?: number; height?: number }): Promise<void>;
  stop(): Promise<void>;
  addListener(eventName: 'stereoFrame', listenerFunc: (payload: StereoFramePayload) => void): Promise<PluginListenerHandle>;
}

let PluginRef: MultiCameraPlugin | null = null;
if (isNative) {
  PluginRef = registerPlugin<MultiCameraPlugin>('MultiCamera');
}

export const NativeMultiCamera = {
  isNative,
  async listCameras() { if (!PluginRef) return { devices: [] }; return PluginRef.listCameras(); },
  async startStereo(leftId: string, rightId: string, width=1280, height=720) { if (!PluginRef) throw new Error('Sólo nativo'); return PluginRef.startStereo({ leftId, rightId, width, height }); },
  async stop() { if (!PluginRef) return; return PluginRef.stop(); },
  async onStereoFrame(cb: (p: StereoFramePayload) => void) { if (!PluginRef) return null as any; return PluginRef.addListener('stereoFrame', cb); },
};

