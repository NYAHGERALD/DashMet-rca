'use client';

import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropModalProps {
  imageSrc: string;
  fileName: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onUseOriginal: () => void;
  onCancel: () => void;
}

function getCroppedImg(image: HTMLImageElement, pixelCrop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = pixelCrop.width * scaleX;
  canvas.height = pixelCrop.height * scaleY;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas is empty'));
    }, 'image/jpeg', 0.92);
  });
}

export default function ImageCropModal({ imageSrc, fileName, onCropComplete, onUseOriginal, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [processing, setProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback(() => {
    // Start with no selection — user draws their own
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current) return;
    if (completedCrop.width < 10 || completedCrop.height < 10) return;
    setProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      onCropComplete(croppedBlob);
    } catch (err) {
      console.error('Crop failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  const hasCrop = completedCrop && completedCrop.width > 10 && completedCrop.height > 10;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[95vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Crop Image</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[300px]">{fileName}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Instruction */}
        <div className="px-5 py-2 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-600 dark:text-blue-400">
          Click and drag on the image to select the area you want to crop.
        </div>

        {/* Crop Area */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900" style={{ maxHeight: '60vh' }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt={fileName}
              onLoad={onImageLoad}
              style={{ maxHeight: '55vh', maxWidth: '100%' }}
              crossOrigin="anonymous"
            />
          </ReactCrop>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={onUseOriginal}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Use Original
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing || !hasCrop}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {processing ? 'Cropping...' : 'Crop & Use'}
          </button>
        </div>
      </div>
    </div>
  );
}
