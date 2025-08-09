import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

export type StereoFramePayload = {
  width: number;
  height: number;
  left: number[];  // RGBA Uint8 list (native lado Kotlin emite enteros)
  right: number[]; // RGBA Uint8 list
};

const isNative = Capacitor.getPlatform() !== 'web';

// Define interface del plugin (métodos esperados)
interface MultiCameraPlugin {
  listCameras(): Promise<{ devices: Array<{ id: string; isBack: boolean; physicalIds?: string[] }> }>;
  startStereo(options: { leftId: string; rightId: string; width?: number; height?: number }): Promise<void>;
  stop(): Promise<void>;
  addListener(eventName: 'stereoFrame', listenerFunc: (payload: StereoFramePayload) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

let PluginRef: MultiCameraPlugin | null = null;
if (isNative) {
  // Registrar el plugin nativo si estamos en plataforma nativa
  PluginRef = registerPlugin<MultiCameraPlugin>('MultiCamera');
}

export const NativeMultiCamera = {
  isNative,
  async listCameras() {
    if (!PluginRef) return { devices: [] };
    return PluginRef.listCameras();
  },
  async startStereo(leftId: string, rightId: string, width = 1280, height = 720) {
    if (!PluginRef) throw new Error('MultiCamera sólo disponible en nativo');
    return PluginRef.startStereo({ leftId, rightId, width, height });
  },
  async stop() {
    if (!PluginRef) return;
    return PluginRef.stop();
  },
  async onStereoFrame(cb: (payload: StereoFramePayload) => void): Promise<PluginListenerHandle | null> {
    if (!PluginRef) return null;
    return PluginRef.addListener('stereoFrame', cb);
  },
};
