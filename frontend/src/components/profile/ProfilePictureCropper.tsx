'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Crop, PixelCrop } from 'react-image-crop';
import { centerCrop, makeAspectCrop } from 'react-image-crop';
import { Camera, Image as ImageIcon, RefreshCw, XCircle } from 'lucide-react';

// Dynamically import ReactCrop with SSR disabled to avoid DOMMatrix error
const ReactCrop = dynamic(
  () => import('react-image-crop').then((mod) => {
    // Import CSS when the component loads on client side
    require('react-image-crop/dist/ReactCrop.css');
    return mod.default;
  }),
  { 
    ssr: false,
    loading: () => <div className="w-full h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse flex items-center justify-center">Loading cropper...</div>
  }
);

interface ProfilePictureCropperProps {
  onImageCropped: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
  currentImage?: string | null;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

export default function ProfilePictureCropper({
  onImageCropped,
  onCancel,
  currentImage,
}: ProfilePictureCropperProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Aspect ratio for head-shoulder portrait (3:4 is common for portraits)
  const aspect = 1; // Square for profile pictures

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraActive(false);
    setIsCameraStarting(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !cameraStreamRef.current) return;

    videoRef.current.srcObject = cameraStreamRef.current;
    videoRef.current.play().catch((error) => {
      console.error('Failed to start camera preview:', error);
      setCameraError('Unable to start the camera preview. Please try again.');
      stopCamera();
    });
  }, [cameraActive, stopCamera]);

  const resetImage = () => {
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setCameraError('Please choose an image file.');
        e.target.value = '';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setCameraError('Please choose an image under 10MB.');
        e.target.value = '';
        return;
      }

      stopCamera();
      setCameraError('');
      resetImage();
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImgSrc(reader.result?.toString() || ''),
      );
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera capture is not supported in this browser. Please upload a photo instead.');
      return;
    }

    if (!window.isSecureContext) {
      setCameraError('Camera access requires HTTPS or localhost. Please use the secure site URL.');
      return;
    }

    stopCamera();
    setIsCameraStarting(true);
    resetImage();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      cameraStreamRef.current = stream;
      setCameraActive(true);
    } catch (error: any) {
      console.error('Failed to access camera:', error);
      const errorName = error?.name;
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setCameraError('No camera was found. Please connect a webcam or upload a photo.');
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        setCameraError('The camera is already in use by another app. Close it and try again.');
      } else {
        setCameraError('Unable to open the camera. Please try again or upload a photo.');
      }
    } finally {
      setIsCameraStarting(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera preview is not ready yet. Please wait a moment and try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Unable to capture the photo. Please try again.');
      return;
    }

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setImgSrc(canvas.toDataURL('image/jpeg', 0.92));
    setCameraError('');
    stopCamera();
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    
    // Auto-detect face region and create initial crop
    // For simplicity, we'll center the crop in the upper portion (head-shoulder area)
    const cropWidth = Math.min(width, height) * 0.8;
    const cropHeight = cropWidth; // Square aspect ratio
    
    // Position crop in upper-center (where head typically is)
    const x = (width - cropWidth) / 2;
    const y = height * 0.05; // Start from top 5% to capture head
    
    const initialCrop: Crop = {
      unit: 'px',
      x,
      y,
      width: cropWidth,
      height: cropHeight,
    };
    
    setCrop(initialCrop);
  };

  const getCroppedImg = useCallback(async (): Promise<Blob | null> => {
    if (!completedCrop || !imgRef.current) {
      return null;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Output size for profile picture (256x256 is a good balance)
    const outputSize = 256;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      outputSize,
      outputSize,
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/jpeg',
        0.9, // High quality
      );
    });
  }, [completedCrop]);

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg();
      if (croppedBlob) {
        onImageCropped(croppedBlob);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Update Profile Picture
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload and crop your photo to show your head and shoulders
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {!imgSrc ? (
            <div className="space-y-6">
              {/* Current Profile Picture Preview */}
              {currentImage && (
                <div className="flex flex-col items-center space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Current Picture</p>
                  <img
                    src={currentImage}
                    alt="Current profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 dark:border-gray-600"
                  />
                </div>
              )}

              {/* Upload / Camera Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onSelectFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-primary-500 dark:hover:border-primary-400 transition-colors"
                >
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-gray-900 dark:text-white">
                        Upload a photo
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        PNG, JPG, GIF up to 10MB
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={isCameraStarting}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-primary-500 dark:hover:border-primary-400 transition-colors disabled:opacity-60 disabled:cursor-wait"
                >
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                      {isCameraStarting ? (
                        <RefreshCw className="w-8 h-8 text-cyan-600 dark:text-cyan-400 animate-spin" aria-hidden="true" />
                      ) : (
                        <Camera className="w-8 h-8 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <p className="text-base font-medium text-gray-900 dark:text-white">
                        Take a photo
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Phone camera or webcam
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {cameraError && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <p>{cameraError}</p>
                </div>
              )}

              {cameraActive && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
                  <div className="overflow-hidden rounded-lg bg-black">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="max-h-[420px] w-full object-contain scale-x-[-1]"
                    />
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:justify-end">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel camera
                    </button>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      Capture photo
                    </button>
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  💡 Tips for a great profile picture
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Use a well-lit photo of your face</li>
                  <li>• Center your head and shoulders in the frame</li>
                  <li>• Use a neutral background if possible</li>
                  <li>• The system will help you crop to the perfect size</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Cropping Area */}
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Drag to adjust the crop area around your head and shoulders
                </p>
                <div className="max-w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={aspect}
                    circularCrop
                    className="max-h-[400px]"
                  >
                    <img
                      ref={imgRef}
                      src={imgSrc}
                      alt="Upload"
                      onLoad={onImageLoad}
                      className="max-h-[400px] w-auto"
                    />
                  </ReactCrop>
                </div>
              </div>

              {/* Preview */}
              {completedCrop && (
                <div className="flex flex-col items-center space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Preview</p>
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary-500 shadow-lg">
                    <canvas
                      ref={(canvas) => {
                        if (canvas && imgRef.current && completedCrop) {
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            const image = imgRef.current;
                            const scaleX = image.naturalWidth / image.width;
                            const scaleY = image.naturalHeight / image.height;
                            
                            canvas.width = 96;
                            canvas.height = 96;
                            
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                            
                            ctx.drawImage(
                              image,
                              completedCrop.x * scaleX,
                              completedCrop.y * scaleY,
                              completedCrop.width * scaleX,
                              completedCrop.height * scaleY,
                              0,
                              0,
                              96,
                              96,
                            );
                          }
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Change Image Button */}
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    resetImage();
                  }}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Choose a different image
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          {imgSrc && (
            <button
              onClick={handleSave}
              disabled={!completedCrop || isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <span>Save Profile Picture</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
