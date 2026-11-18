'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ScannerState = 'idle' | 'starting' | 'scanning' | 'error';

/**
 * Thin wrapper around html5-qrcode. The camera is only started client-side after
 * an explicit user action, and always stopped/cleared on unmount so the phone
 * camera light cannot stay on when the vendor navigates away.
 */
export function QrScanner({
  onResult,
  active = true,
  onError,
}: {
  onResult: (value: string) => void;
  active?: boolean;
  onError?: (message: string) => void;
}) {
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
    getRunningTrackCameraCapabilities?: () => {
      zoomFeature: () => {
        isSupported: () => boolean;
        apply: (value: number) => Promise<void>;
        value: () => number | null;
        min: () => number;
        max: () => number;
      };
    };
    applyVideoConstraints?: (constraints: MediaTrackConstraints) => Promise<void>;
  } | null>(null);
  const onResultRef = useRef(onResult);
  const handledRef = useRef(false);
  const [state, setState] = useState<ScannerState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [cameraLabel, setCameraLabel] = useState<string | null>(null);
  // Hardware zoom, when the camera supports it. A coupon held at arm's length
  // fills too little of a 1x frame, so scanning opens a little zoomed in.
  const [zoom, setZoom] = useState<{ value: number; min: number; max: number } | null>(null);

  async function changeZoom(target: number) {
    const feature = scannerRef.current?.getRunningTrackCameraCapabilities?.().zoomFeature();
    if (!feature?.isSupported() || !zoom) return;
    const value = Math.min(Math.max(target, zoom.min), zoom.max);
    try {
      await feature.apply(value);
      setZoom({ ...zoom, value });
    } catch {
      // Ignore: the stream keeps its current zoom.
    }
  }

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    handledRef.current = false;

    async function start() {
      setState('starting');
      setError(null);
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;

        // Ask for permission once first. Camera *labels* are hidden until the
        // browser has an active grant, and the labels are how we avoid selecting
        // an ultra-wide 0.6x lens (which cannot read a dense QR code).
        try {
          const warmup = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
          warmup.getTracks().forEach((track) => track.stop());
        } catch {
          // If denied, the scanner start below surfaces the permission error.
        }

        // Some Android browsers default `facingMode: environment` to an
        // ultra-wide 0.6x lens, which makes a dense QR code impossible to read.
        // Prefer a labelled main rear camera and explicitly normalise zoom to 1x.
        let selectedCamera: { id: string; label: string } | null = null;
        try {
          const cameras = await Html5Qrcode.getCameras();
          const labelled = cameras.filter((camera) => camera.label.trim().length > 0);
          if (labelled.length > 0) {
            selectedCamera =
              labelled.find(
                (camera) =>
                  /back|rear|environment/i.test(camera.label) &&
                  !/ultra[\s-]?wide|wide[\s-]?angle|telephoto|macro|depth|fisheye/i.test(
                    camera.label,
                  ),
              ) ??
              labelled.find((camera) => /back|rear|environment/i.test(camera.label)) ??
              labelled[0];
          }
        } catch {
          // Labels/permission can be unavailable; facingMode below is the fallback.
        }

        const scanner = new Html5Qrcode('kupon-scanner-region', {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = scanner;

        const config = {
          fps: 12,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.74);
            return { width: edge, height: edge };
          },
          aspectRatio: 1,
          disableFlip: true,
        };

        try {
          if (selectedCamera) {
            await scanner.start(
              { deviceId: { exact: selectedCamera.id } },
              config,
              handleDecoded,
              () => undefined,
            );
          } else {
            throw new Error('No labelled camera; using environment fallback');
          }
        } catch {
          // Some browsers expose IDs that cannot be opened with `exact`. Fall
          // back to the conventional rear camera rather than failing the screen.
          await scanner.start(
            { facingMode: { ideal: 'environment' } },
            config,
            handleDecoded,
            () => undefined,
          );
        }

        if (!cancelled) {
          setState('scanning');
          setCameraLabel(selectedCamera?.label ?? 'Back camera');
        }

        // Normalise the lens. This is the important fix for phones that expose
        // an ultra-wide camera as the default video track at 0.6x.
        try {
          const caps = scanner.getRunningTrackCameraCapabilities?.();
          const zoom = caps?.zoomFeature?.();
          if (zoom?.isSupported()) {
            const min = zoom.min();
            const max = zoom.max();
            const target = Math.min(Math.max(1.5, min), max);
            if (Math.abs((zoom.value() ?? target) - target) > 0.01) {
              await zoom.apply(target);
            }
            if (!cancelled) setZoom({ value: target, min, max });
          }
        } catch {
          // Not every camera supports programmatic zoom; keep the stream as-is.
        }
        try {
          await scanner.applyVideoConstraints?.({
            advanced: [{ focusMode: 'continuous' }],
          } as unknown as MediaTrackConstraints);
        } catch {
          // Focus mode is optional too.
        }

        function handleDecoded(decodedText: string) {
          if (handledRef.current) return;
          handledRef.current = true;
          if (navigator.vibrate) navigator.vibrate([35, 30, 35]);
          void scanner.stop().catch(() => undefined);
          onResultRef.current(decodedText);
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Camera unavailable. Check browser permission or use the 6-digit code.';
        setError(
          /permission|denied|notallowed/i.test(message)
            ? 'Camera permission was denied. Allow camera access in your browser, or use the manual code fallback below.'
            : 'Could not start the camera on this device. Use the manual code fallback below.',
        );
        setState('error');
        onError?.('Camera unavailable');
      }
    }

    void start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        try {
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => undefined);
        } catch {
          // html5-qrcode throws synchronously when the camera never started
          // (e.g. permission denied). Always clear the injected DOM node.
          try {
            scanner.clear();
          } catch {
            /* already cleared */
          }
        }
      }
    };
  }, [active, attempt, onError]);

  if (!active) return null;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-navy shadow-lift">
        <div
          id="kupon-scanner-region"
          className="min-h-[260px] w-full [&_video]:!h-[260px] [&_video]:!w-full [&_video]:object-cover"
        />
        {state === 'scanning' ? (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[220px] w-[220px] rounded-2xl border-2 border-white/25">
                <span className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-gold" />
                <span className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-gold" />
                <span className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-gold" />
                <span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-gold" />
                <span className="absolute left-3 right-3 top-1/2 h-px animate-pulse bg-gold shadow-[0_0_12px_2px_rgba(227,195,111,0.8)]" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 px-3">
              <span className="pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-navy/80 px-3 py-1.5 text-[11px] font-medium text-white">
                <Camera className="h-3 w-3" aria-hidden />
                Fit the QR inside the frame
              </span>
              {zoom && zoom.max > zoom.min ? (
                <div className="flex rounded-full bg-navy/80 p-0.5" role="group" aria-label="Camera zoom">
                  {[1, 2].filter((level) => level >= zoom.min - 0.01 && level <= zoom.max + 0.01).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => void changeZoom(level)}
                      aria-pressed={Math.abs(zoom.value - level) < 0.05}
                      className={
                        Math.abs(zoom.value - level) < 0.05
                          ? 'min-h-8 rounded-full bg-gold px-3 text-[11px] font-bold text-navy'
                          : 'min-h-8 rounded-full px-3 text-[11px] font-semibold text-white'
                      }
                    >
                      {level}×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {state === 'starting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-navy text-slate-300">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
            <p className="text-xs">Starting camera…</p>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-navy px-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <CameraOff className="h-5 w-5 text-slate-300" />
            </span>
            <p className="text-xs leading-relaxed text-slate-300">{error}</p>
            <Button
              type="button"
              variant="subtle"
              size="sm"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try camera again
            </Button>
          </div>
        ) : null}
      </div>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
        <ScanLine className="h-3.5 w-3.5" aria-hidden />
        {cameraLabel ? cameraLabel : 'Back camera'}
      </p>
    </div>
  );
}
