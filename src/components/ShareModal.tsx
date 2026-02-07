import { useEffect, useMemo, useRef, useState } from 'react';
import { domToCanvas } from '@/lib/domToCanvas';
import { Download, Loader2, MessageCircle } from 'lucide-react';

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

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  wheelElement?: HTMLElement | null;
}

export function ShareModal({ isOpen, onClose, restaurant, wheelElement }: ShareModalProps) {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [wheelImageUrl, setWheelImageUrl] = useState<string>();
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
    if (!isOpen) return;

    setIsGenerating(true);
    setError(null);

    try {
      let capturedWheelImage: string | undefined;

      if (wheelElement) {
        const wheelCanvas = await domToCanvas(wheelElement, {
          scale: 2,
          backgroundColor: '#FFF9F4',
        });
        capturedWheelImage = wheelCanvas.toDataURL('image/png');
      }

      setWheelImageUrl(capturedWheelImage);

      await new Promise((resolve) => setTimeout(resolve, 80));

      if (!shareCardRef.current) {
        throw new Error('Share card preview is unavailable.');
      }

      const cardCanvas = await domToCanvas(shareCardRef.current, {
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
  }, [isOpen, restaurant.id, wheelElement]);

  const downloadImage = () => {
    if (!shareImageUrl) return;

    const safeRestaurantName = restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const link = document.createElement('a');
    link.href = shareImageUrl;
    link.download = `eatspin-result-${safeRestaurantName}.png`;
    link.click();
  };

  const handleWhatsAppShare = async () => {
    if (!shareImageUrl) return;

    try {
      const hasCanShare = typeof navigator.canShare === 'function';
      if (hasCanShare) {
        const imageBlob = await (await fetch(shareImageUrl)).blob();
        const file = new File([imageBlob], 'eatspin-result.png', { type: 'image/png' });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            text: shareText,
            files: [file],
            title: 'EatSpin Result',
          });
          return;
        }
      }
    } catch {
      // fall back to wa.me
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl border-eatspin-peach bg-[#FFF9F4]/95 p-0 backdrop-blur-md" showCloseButton>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Share your result</DialogTitle>
            <DialogDescription>Share to WhatsApp and instagram story, or download your result image.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-6">
            <div className="overflow-hidden rounded-xl border border-eatspin-peach bg-white p-4">
              {isGenerating ? (
                <div className="flex h-[360px] items-center justify-center gap-3 text-eatspin-gray-1">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Generating your share image...
                </div>
              ) : (
                <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-lg border bg-[#FFF9F4] shadow-md">
                  <div className="origin-top-left scale-[0.35]" style={{ width: '1080px', height: '1350px' }}>
                    <ShareResultCard restaurant={restaurant} wheelImageUrl={wheelImageUrl} />
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="w-full bg-[#25D366] text-white hover:bg-[#1EA952]"
                onClick={handleWhatsAppShare}
                disabled={isGenerating || !shareImageUrl}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Share to WhatsApp and instagram story
              </Button>
              <Button
                className="w-full bg-brand-orange text-white hover:bg-eatspin-orange"
                onClick={downloadImage}
                disabled={isGenerating || !shareImageUrl}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Image
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="pointer-events-none fixed -left-[9999px] top-0 opacity-0">
        <div ref={shareCardRef}>
          <ShareResultCard restaurant={restaurant} wheelImageUrl={wheelImageUrl} />
        </div>
      </div>
    </>
  );
}
