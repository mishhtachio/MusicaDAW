export interface CameraErrorDetails {
  type: 'permission_denied' | 'not_found' | 'in_use' | 'insecure_context' | 'unknown';
  message: string;
  advice: string;
}

/**
 * Checks if current environment is in a secure context required for getUserMedia.
 */
export function isSecureContext(): boolean {
  return window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * Analyzes DOMException from getUserMedia and converts it to actionable, kid/parent-friendly advice.
 */
export function parseCameraError(error: unknown): CameraErrorDetails {
  if (!isSecureContext()) {
    return {
      type: 'insecure_context',
      message: 'Camera access requires a secure connection (HTTPS or localhost).',
      advice: 'Please open this app over HTTPS or on localhost.'
    };
  }

  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return {
          type: 'permission_denied',
          message: 'Camera permission was denied.',
          advice: 'Please click the camera icon in your browser address bar to allow camera access, then tap Retry.'
        };
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return {
          type: 'not_found',
          message: 'No physical camera was found on this device.',
          advice: 'Make sure your webcam or mobile camera is connected, or switch to simulated test feed.'
        };
      case 'NotReadableError':
      case 'TrackStartError':
        return {
          type: 'in_use',
          message: 'Camera is currently in use by another app or browser tab.',
          advice: 'Please close any other apps or tabs using the camera and tap Retry.'
        };
      case 'OverconstrainedError':
        return {
          type: 'unknown',
          message: 'Camera requested settings are not supported by this device.',
          advice: 'Retrying with standard camera settings...'
        };
      default:
        return {
          type: 'unknown',
          message: error.message || 'Could not access the camera.',
          advice: 'Please check your browser permissions and try again.'
        };
    }
  }

  return {
    type: 'unknown',
    message: String(error) || 'An unexpected error occurred accessing the camera.',
    advice: 'Please check camera permissions and tap Retry.'
  };
}

/**
 * Requests a camera MediaStream, prioritizing the environment (rear) camera on mobile.
 */
export async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('navigator.mediaDevices.getUserMedia is not supported on this browser.');
  }

  // First try: ideal environment camera (rear-facing mobile)
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
  } catch (err) {
    // If overconstrained or failed, fallback to any available video stream
    console.warn('[CameraManager] Environment facing camera failed, falling back to standard video:', err);
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true
    });
  }
}

/**
 * Safely stops all active tracks in a MediaStream.
 */
export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  try {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  } catch (err) {
    console.warn('[CameraManager] Error stopping stream track:', err);
  }
}

