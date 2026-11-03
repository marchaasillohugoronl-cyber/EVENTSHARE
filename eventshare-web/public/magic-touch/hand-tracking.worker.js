/* Classic worker: MediaPipe's WASM loader uses importScripts. All assets are same-origin. */
let detector;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      importScripts('./vendor/vision_bundle.js');
      const files = await Vision.FilesetResolver.forVisionTasks(new URL('./vendor/wasm', self.location.href).href);
      detector = await Vision.HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./hand_landmarker.task', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: .7, minHandPresenceConfidence: .7, minTrackingConfidence: .7,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame' && detector) {
      try {
        const result = detector.detectForVideo(data.bitmap, data.timestamp);
        self.postMessage({ type: 'result', timestamp: data.timestamp, hands: result.landmarks.map((landmarks, i) => ({
          landmarks, confidence: result.handedness[i]?.[0]?.score ?? 0, side: result.handedness[i]?.[0]?.categoryName ?? '',
        })) });
      } finally { data.bitmap.close(); }
    }
  } catch {
    self.postMessage({ type: 'error', message: 'No se pudo iniciar o ejecutar el detector de manos. Desactiva Magic Touch y vuelve a intentarlo.' });
  }
};
