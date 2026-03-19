import React, { useState } from 'react';
import { Portal } from '@/components/Portal';
import type { ImageBlockDto } from '../../../../dto/message/ContentBlockDto';

interface ImageAttachmentsProps {
  images: ImageBlockDto[];
}

export const ImageAttachments: React.FC<ImageAttachmentsProps> = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const getImageSrc = (image: ImageBlockDto): string => {
    if (image.source.type === 'base64') {
      return `data:${image.source.media_type};base64,${image.source.data}`;
    }
    return image.source.data; // URL type
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <div
            key={`img-${index}-${image.source.media_type}`}
            className="group relative cursor-pointer"
            onClick={() => setSelectedImage(getImageSrc(image))}
          >
            <div className="overflow-hidden rounded-md border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800/80 transition-colors">
              <img
                src={getImageSrc(image)}
                alt={`Image ${index + 1}`}
                className="w-[110px] h-[60px] object-cover"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox for full-size image */}
      {selectedImage && (
        <Portal>
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
              className="absolute -top-3.5 -right-3.5 w-7 h-7 flex items-center justify-center rounded-full bg-zinc-800/20 hover:bg-zinc-700/70 border border-zinc-700 text-zinc-200 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
};
