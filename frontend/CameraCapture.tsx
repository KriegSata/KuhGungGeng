import {useEffect, useRef, useState} from 'react';
import {Camera, ImagePlus, X} from 'lucide-react';

function cameraError(error: unknown) {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was blocked. Allow it in your browser settings or open Shellfie in a browser tab.';
  }
  if (name === 'NotFoundError') return 'No camera was found. Connect a camera or upload a photo.';
  if (name === 'NotReadableError') return 'The camera may be busy. Close any other app using it and try again.';
  return 'The camera could not start. Try again or upload a photo.';
}

export default function CameraCapture({onClose, onPhoto, onUpload}: {
  onClose: () => void; onPhoto: (photo: File) => void; onUpload: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const modal = dialog.current;
    const video = preview.current;
    if (!modal || !video) return;
    if (!modal.open) modal.showModal();

    let active = true;
    let stream: MediaStream | undefined;
    async function startCamera() {
      if (!active || !video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(window.isSecureContext === false
          ? 'Open Shellfie over HTTPS or on localhost to use the camera.'
          : 'This browser cannot open a live camera. You can upload a photo instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {facingMode: {ideal: 'environment'}, width: {ideal: 1600}, height: {ideal: 1200}},
        });
        if (active) video.srcObject = stream;
        else stream.getTracks().forEach(track => track.stop());
      } catch (cause) {
        if (active) setError(cameraError(cause));
      }
    }

    // Let the effect's development cleanup run before requesting the camera.
    queueMicrotask(() => void startCamera());
    return () => {
      active = false;
      stream?.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    };
  }, []);

  function close() {
    dialog.current?.close();
    onClose();
  }

  function takePhoto() {
    const video = preview.current;
    if (!video || !video.videoWidth || !video.videoHeight || saving) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2048 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Could not capture this frame. You can upload a photo instead.');
      return;
    }
    setSaving(true);
    setError('');
    function showCaptureError() {
      setError('Could not save this frame. Try taking the photo again.');
      setSaving(false);
    }
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!dialog.current?.open) return;
        if (!blob) {
          showCaptureError();
          return;
        }
        close();
        onPhoto(new File([blob], 'shellfie-camera.jpg', {type: 'image/jpeg'}));
      }, 'image/jpeg', .9);
    } catch {
      showCaptureError();
    }
  }

  return <dialog ref={dialog} className="camera-capture" aria-labelledby="camera-heading" onCancel={event => {
    event.preventDefault();
    close();
  }}>
    <header className="camera-toolbar">
      <h2 id="camera-heading">Take a crab photo</h2>
      <button type="button" autoFocus className="camera-close" aria-label="Close camera" onClick={close}><X size={20}/></button>
    </header>
    <div className="camera-frame" data-ready={ready}>
      <video ref={preview} autoPlay muted playsInline aria-label="Live camera preview" onLoadedData={() => setReady(true)}/>
      {!ready && !error && <p role="status">Allow camera access to see the live preview.</p>}
      {!ready && error && <Camera size={32} aria-hidden="true"/>}
    </div>
    {error ? <p className="camera-message" role="alert">{error}</p>
      : <p className="camera-message">Keep the whole crab in view.</p>}
    <div className="camera-actions">
      <button type="button" className="primary" onClick={takePhoto} disabled={!ready || saving}>
        <Camera size={18} aria-hidden="true"/> {saving ? 'Saving photo…' : 'Capture photo'}
      </button>
      {error && <button type="button" className="secondary" onClick={() => {close(); onUpload();}}>
        <ImagePlus size={18} aria-hidden="true"/> Upload instead
      </button>}
    </div>
  </dialog>;
}
