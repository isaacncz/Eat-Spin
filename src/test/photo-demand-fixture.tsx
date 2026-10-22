import { createRoot } from 'react-dom/client';
import { PhotoCarousel } from '@/components/PhotoCarousel';
export function mountPhotos() {
  const container = document.createElement('div');
  container.setAttribute('data-testid', 'photo-demand-fixture');
  document.body.prepend(container);
  createRoot(container).render(<PhotoCarousel alt="Synthetic restaurant"
    photos={['/test-photos/one.svg', '/test-photos/two.svg', '/test-photos/three.svg']} />);
}
