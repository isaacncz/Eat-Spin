import { createRoot } from 'react-dom/client';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
const PHOTOS = ['/test-photos/one.svg', '/test-photos/two.svg', '/test-photos/three.svg'];
export function mountPhotos() {
  const container = document.createElement('div');
  container.setAttribute('data-testid', 'photo-demand-fixture');
  document.body.prepend(container);
  createRoot(container).render(<PhotoCarousel alt="Synthetic restaurant" photos={PHOTOS} />);
}
/** The carousel inside another modal dialog, like the result screen. */
export function mountPhotosInDialog() {
  const container = document.createElement('div');
  document.body.prepend(container);
  createRoot(container).render(
    <Dialog defaultOpen>
      <DialogContent>
        <DialogTitle>Outer dialog</DialogTitle>
        <DialogDescription className="sr-only">Holds a photo carousel.</DialogDescription>
        <PhotoCarousel alt="Synthetic restaurant" photos={PHOTOS} />
      </DialogContent>
    </Dialog>,
  );
}
