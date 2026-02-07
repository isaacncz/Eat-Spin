interface CaptureOptions {
  scale?: number;
  backgroundColor?: string;
}

export async function domToCanvas(element: HTMLElement, options: CaptureOptions = {}): Promise<HTMLCanvasElement> {
  const rect = element.getBoundingClientRect();
  const scale = options.scale ?? 1;
  const width = Math.max(Math.ceil(rect.width), 1);
  const height = Math.max(Math.ceil(rect.height), 1);

  const clonedElement = element.cloneNode(true) as HTMLElement;

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.background = options.backgroundColor ?? 'transparent';
  wrapper.appendChild(clonedElement);

  const serializedNode = new XMLSerializer().serializeToString(wrapper);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">${serializedNode}</foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to render node as image'));
      image.src = blobUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(Math.floor(width * scale), 1);
    canvas.height = Math.max(Math.floor(height * scale), 1);

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context unavailable');
    }

    if (options.backgroundColor) {
      context.fillStyle = options.backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    return canvas;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
