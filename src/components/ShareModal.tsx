import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Instagram, Loader2, MessageCircle } from 'lucide-react';

import type { Restaurant } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShareResultCard } from '@/components/ShareResultCard';
import { domToCanvas } from '@/lib/domToCanvas';

type Html2CanvasFn = (element: HTMLElement, options?: {
  scale?: number;
  backgroundColor?: string;
  useCORS?: boolean;
}) => Promise<HTMLCanvasElement>;

declare global {
  interface Window {
    html2canvas?: Html2CanvasFn;
  }
}

let html2CanvasLoader: Promise<Html2CanvasFn | null> | null = null;

async function loadHtml2Canvas(): Promise<Html2CanvasFn | null> {
  if (window.html2canvas) return window.html2canvas;

  if (!html2CanvasLoader) {
    html2CanvasLoader = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.async = true;
      script.onload = () => resolve(window.html2canvas ?? null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  return html2CanvasLoader;
}

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: Restaurant;
}

async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

export function ShareModal({ isOpen, onClose, restaurant }: ShareModalProps) {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [shareImageUrl, setShareImageUrl] = useState<string>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareText = useMemo(() => {
    const distance = restaurant.distance ? `${restaurant.distance.toFixed(1)}km away` : 'Distance unavailable';
    const address = restaurant.address ? `📍 ${restaurant.address}` : '';

    return [
      `🎰 I got ${restaurant.name} on EatSpin!`,
      '',
      `⭐ ${restaurant.rating.toFixed(1)}/5 • ${restaurant.priceRange} • ${distance}`,
      address,
      '',
      '🔗 try it out at eatspin.netlify.com',
    ]
      .filter(Boolean)
      .join('\n');
  }, [restaurant]);

  const generateImage = async () => {
    if (!isOpen || !shareCardRef.current) return;

    setIsGenerating(true);
    setError(null);

    try {
      await waitForImages(shareCardRef.current);
      const html2canvas = await loadHtml2Canvas();
      const cardCanvas = html2canvas
        ? await html2canvas(shareCardRef.current, {
            scale: 2,
            backgroundColor: '#FFF9F4',
            useCORS: true,
          })
        : await domToCanvas(shareCardRef.current, {
            scale: 2,
            backgroundColor: '#FFF9F4',
          });
      setShareImageUrl(cardCanvas.toDataURL('image/png'));
    } catch {
      setError('Could not generate your share image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      return;
    }

    generateImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, restaurant.id]);

  const getFile = async () => {
    if (!shareImageUrl) return null;
    const imageBlob = await (await fetch(shareImageUrl)).blob();
    return new File([imageBlob], 'eatspin-result.png', { type: 'image/png' });
  };

  const downloadImage = () => {
    if (!shareImageUrl) return;

    const safeRestaurantName = restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const link = document.createElement('a');
    link.href = shareImageUrl;
    link.download = `eatspin-result-${safeRestaurantName}.png`;
    link.click();
  };

  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleInstagramStoryShare = async () => {
    try {
      const file = await getFile();
      const hasNativeShare = typeof navigator.canShare === 'function' && typeof navigator.share === 'function';

      if (file && hasNativeShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'EatSpin Result',
          text: 'Sharing to Instagram Story',
        });
        return;
      }

      downloadImage();
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    } catch {
      setError('Instagram sharing is not supported on this device. Image downloaded instead.');
      downloadImage();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl border-eatspin-peach bg-[#FFF9F4]/95 p-0 backdrop-blur-md" showCloseButton>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Share your result</DialogTitle>
            <DialogDescription>Send to WhatsApp, share to Instagram Story, or download your result image.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-6">
            <div className="flex h-[560px] items-center justify-center overflow-hidden rounded-xl border border-eatspin-peach bg-white p-4">
              {isGenerating ? (
                <div className="flex items-center justify-center gap-3 text-eatspin-gray-1">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Generating your share image...
                </div>
              ) : shareImageUrl ? (
                <img src={shareImageUrl} alt="Generated share card preview" className="h-full w-auto rounded-lg border bg-[#FFF9F4] shadow-md" />
              ) : (
                <p className="text-sm text-red-500">Preview unavailable</p>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="w-full bg-[#25D366] text-white hover:bg-[#1EA952]"
                onClick={handleWhatsAppShare}
                disabled={isGenerating || !shareImageUrl}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Send to WhatsApp
              </Button>
              <Button
                className="w-full bg-[#E4405F] text-white hover:bg-[#cc2f4f]"
                onClick={handleInstagramStoryShare}
                disabled={isGenerating || !shareImageUrl}
              >
                <Instagram className="mr-2 h-4 w-4" />
                Share to Instagram Story
              </Button>
            </div>

            <Button
              className="w-full bg-brand-orange text-white hover:bg-eatspin-orange"
              onClick={downloadImage}
              disabled={isGenerating || !shareImageUrl}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Image
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="pointer-events-none fixed -left-[9999px] top-0 opacity-0">
        <div ref={shareCardRef}>
          <ShareResultCard restaurant={restaurant} />
        </div>
      </div>
    </>
  );
}
