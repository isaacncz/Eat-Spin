import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhotoCarousel } from '@/components/PhotoCarousel';
describe('on-demand photos', () => {
  it('renders only the first image src, not hidden slide URLs', () => {
    const html = renderToStaticMarkup(createElement(PhotoCarousel, {
      photos: ['https://example.com/first.jpg', 'https://example.com/second.jpg', 'https://example.com/third.jpg'],
      alt: 'Test restaurant',
    }));
    expect(html).toContain('src="https://example.com/first.jpg"');
    expect(html).not.toContain('src="https://example.com/second.jpg"');
    expect(html).not.toContain('src="https://example.com/third.jpg"');
  });
  it('renders no image for an empty photo list', () => {
    expect(renderToStaticMarkup(createElement(PhotoCarousel, { photos: [], alt: 'Test' }))).not.toContain('<img');
  });
});
