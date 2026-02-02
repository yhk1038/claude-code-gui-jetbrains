import React, { useState } from 'react';
import { MessageImage } from '../../../types';

interface ImageAttachmentsProps {
  images: MessageImage[];
}

export const ImageAttachments: React.FC<ImageAttachmentsProps> = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const getImageSrc = (image: MessageImage): string => {
    if (image.type === 'base64') {
      return `data:${image.mediaType};base64,${image.data}`;
    }
    return image.data; // URL type
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {images.map((image, index) => (
          <div
            key={index}
            className="group relative cursor-pointer"
            onClick={() => setSelectedImage(getImageSrc(image))}
          >
            <div className="overflow-hidden rounded-md border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800/80 transition-colors">
              <img
                src={getImageSrc(image)}
                alt={image.filename || `Image ${index + 1}`}
                className="w-[120px] h-[90px] object-cover"
              />
            </div>
            {image.filename && (
              <div className="mt-1 px-1">
                <span className="text-xs text-zinc-400 truncate block max-w-[120px]">
                  {image.filename}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox for full-size image */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
};
