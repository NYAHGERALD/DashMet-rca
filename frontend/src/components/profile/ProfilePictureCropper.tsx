'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Crop, PixelCrop } from 'react-image-crop';
import { centerCrop, makeAspectCrop } from 'react-image-crop';

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
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Aspect ratio for head-shoulder portrait (3:4 is common for portraits)
  const aspect = 1; // Square for profile pictures

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImgSrc(reader.result?.toString() || ''),
      );
      reader.readAsDataURL(e.target.files[0]);
    }
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

              {/* Upload Area */}
              <div
                onClick={triggerFileInput}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onSelectFile}
                  className="hidden"
                />
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      Click to upload a photo
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </div>
                </div>
              </div>

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
                    setImgSrc('');
                    setCrop(undefined);
                    setCompletedCrop(undefined);
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
            onClick={onCancel}
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
