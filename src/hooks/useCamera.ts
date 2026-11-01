import { useState, useRef, useEffect, useCallback } from 'react';
import type { CameraStatus } from '../types/camera';
import {
  requestCameraStream,
  stopStream,
  parseCameraError,
  type CameraErrorDetails
} from '../camera/cameraManager';

export function useCamera() {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorDetails, setErrorDetails] = useState<CameraErrorDetails | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMockFeed, setIsMockFeed] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      stopStream(streamRef.current);
      streamRef.current = null;
    }
    setStream(null);
    setStatus('idle');
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setStatus('requesting');
    setErrorDetails(null);
    setIsMockFeed(false);

    try {
      const newStream = await requestCameraStream();
      streamRef.current = newStream;
      setStream(newStream);
      setStatus('active');
    } catch (err) {
      console.error('[useCamera] Camera initialization failed:', err);
      const parsed = parseCameraError(err);
      setErrorDetails(parsed);
      setStatus('error');
    }
  }, [stopCamera]);

  const retry = useCallback(() => {
    startCamera();
  }, [startCamera]);

  const enableMockFeed = useCallback(() => {
    stopCamera();
    setErrorDetails(null);
    setIsMockFeed(true);
    setStatus('active');
  }, [stopCamera]);

  // Cleanup tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        stopStream(streamRef.current);
        streamRef.current = null;
      }
    };
  }, []);

  return {
    status,
    errorDetails,
    stream,
    isMockFeed,
    startCamera,
    stopCamera,
    retry,
    enableMockFeed
  };
}

