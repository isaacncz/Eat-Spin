export type ShareCardMethod = 'native-file' | 'native-text' | 'download';

interface ShareCardOptions {
  element: HTMLElement;
  fileName: string;
  title: string;
  text: string;
  url: string;
}

const downloadBlob = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 500);
};

const supportsFileShare = (file: File): boolean => {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
};

export const shareCard = async ({
  element,
  fileName,
  title,
  text,
  url,
}: ShareCardOptions): Promise<ShareCardMethod> => {
  // Dynamic import — html-to-image (~150KB) only loaded when user shares
  const { toBlob } = await import('html-to-image');

  const imageBlob = await toBlob(element, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#ffffff',
  });

  if (!imageBlob) {
    throw new Error('Unable to generate share image.');
  }

  const safeFileName = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
  const imageFile = new File([imageBlob], safeFileName, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    if (supportsFileShare(imageFile)) {
      await navigator.share({
        title,
        text,
        url,
        files: [imageFile],
      });
      return 'native-file';
    }

    await navigator.share({ title, text, url });
    return 'native-text';
  }

  downloadBlob(imageBlob, safeFileName);
  return 'download';
};
