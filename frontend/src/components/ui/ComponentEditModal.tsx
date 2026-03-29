'use client';

import React from 'react';

interface PhotoItem {
  url: string;
  name: string;
}

interface ComponentEditModalProps {
  isOpen: boolean;
  isEditing: boolean;
  compForm: {
    name: string;
    description: string;
    partNumber: string;
    manufacturer: string;
    isCritical: boolean;
  };
  setCompForm: (form: { name: string; description: string; partNumber: string; manufacturer: string; isCritical: boolean }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  uploading: boolean;
  // New photo previews
  compPhotoPreviews: string[];
  compPendingPhotos: File[];
  onAddPhotos: (files: File[]) => void;
  onRemovePreview: (index: number) => void;
  // Existing photos (edit mode)
  existingPhotos: PhotoItem[];
  onDeleteExistingPhoto: (url: string) => void;
  onPhotoClick: (photos: PhotoItem[], index: number) => void;
  // Rename
  renamingPhotoUrl: string | null;
  renameValue: string;
  setRenamingPhotoUrl: (url: string | null) => void;
  setRenameValue: (val: string) => void;
  onRenamePhoto: (url: string, name: string) => void;
}

export default function ComponentEditModal({
  isOpen,
  isEditing,
  compForm,
  setCompForm,
  onSubmit,
  onCancel,
  uploading,
  compPhotoPreviews,
  compPendingPhotos,
  onAddPhotos,
  onRemovePreview,
  existingPhotos,
  onDeleteExistingPhoto,
  onPhotoClick,
  renamingPhotoUrl,
  renameValue,
  setRenamingPhotoUrl,
  setRenameValue,
  onRenamePhoto,
}: ComponentEditModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-primary-600 to-primary-700">
          <h3 className="text-base font-bold text-white">
            {isEditing ? 'Edit Component' : 'Add Component'}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Component Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={compForm.name}
              onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
              placeholder="e.g. Servo Motor"
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Part Number + Manufacturer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Part Number
              </label>
              <input
                type="text"
                value={compForm.partNumber}
                onChange={(e) => setCompForm({ ...compForm, partNumber: e.target.value })}
                placeholder="e.g. 1234GH"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Manufacturer
              </label>
              <input
                type="text"
                value={compForm.manufacturer}
                onChange={(e) => setCompForm({ ...compForm, manufacturer: e.target.value })}
                placeholder="e.g. MT-Motors"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={compForm.description}
              onChange={(e) => setCompForm({ ...compForm, description: e.target.value })}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Photos
            </label>
            <div className="border border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Add Photos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) onAddPhotos(files);
                      e.target.value = '';
                    }}
                  />
                </label>
                <span className="text-sm text-gray-400">
                  {compPendingPhotos.length > 0 ? `${compPendingPhotos.length} selected` : 'optional'}
                </span>
              </div>

              {/* New previews */}
              {compPhotoPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {compPhotoPreviews.map((src, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={src}
                        alt={compPendingPhotos[idx]?.name || `Preview ${idx + 1}`}
                        className="w-16 h-16 object-contain rounded border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 cursor-pointer"
                        onClick={() => onPhotoClick([{ url: src, name: compPendingPhotos[idx]?.name || `Photo ${idx + 1}` }], 0)}
                      />
                      <button
                        type="button"
                        onClick={() => onRemovePreview(idx)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Existing photos (edit mode) */}
              {existingPhotos.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-1.5">Existing:</p>
                  <div className="flex flex-wrap gap-2">
                    {existingPhotos.map((photo, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={photo.url}
                          alt={photo.name || `Photo ${idx + 1}`}
                          className="w-16 h-16 object-contain rounded border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 cursor-pointer"
                          onClick={() => onPhotoClick(existingPhotos, idx)}
                        />
                        {renamingPhotoUrl === photo.url ? (
                          <form
                            className="mt-0.5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              onRenamePhoto(photo.url, renameValue);
                            }}
                          >
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              autoFocus
                              className="w-16 text-sm px-0.5 py-0.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                              onBlur={() => { setRenamingPhotoUrl(null); setRenameValue(''); }}
                              onKeyDown={(e) => { if (e.key === 'Escape') { setRenamingPhotoUrl(null); setRenameValue(''); } }}
                            />
                          </form>
                        ) : (
                          <p
                            className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-[64px] truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                            title="Click to rename"
                            onClick={() => { setRenamingPhotoUrl(photo.url); setRenameValue(photo.name || ''); }}
                          >
                            {photo.name || 'Unnamed'}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteExistingPhoto(photo.url)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Critical Part */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={compForm.isCritical}
              onChange={(e) => setCompForm({ ...compForm, isCritical: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Critical Part
          </label>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {uploading ? 'Uploading...' : isEditing ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
