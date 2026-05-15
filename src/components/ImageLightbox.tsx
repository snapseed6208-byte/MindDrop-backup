import { useEffect, useRef, useState } from 'react';

interface Props {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export default function ImageLightbox({ images, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const goPrev = () => setIndex(i => (i > 0 ? i - 1 : images.length - 1));
  const goNext = () => setIndex(i => (i < images.length - 1 ? i + 1 : 0));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center select-none"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white/80
                   flex items-center justify-center text-xl hover:bg-white/20 transition-colors"
      >
        ✕
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <span className="absolute top-4 left-4 z-10 text-sm text-white/70 bg-black/30 rounded-full px-3 py-1">
          {index + 1} / {images.length}
        </span>
      )}

      {/* Image */}
      <div
        className="flex items-center justify-center w-full h-full px-12 py-16"
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={images[index]}
          alt=""
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Navigation buttons */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                       bg-white/10 text-white/80 flex items-center justify-center text-lg
                       hover:bg-white/20 transition-colors"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                       bg-white/10 text-white/80 flex items-center justify-center text-lg
                       hover:bg-white/20 transition-colors"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
