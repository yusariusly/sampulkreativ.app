export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
  minQuality?: number;
}

export const IMAGE_PRESETS = {
  profile: {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.6,
    maxSizeKB: 40,
    minQuality: 0.25
  },
  report: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.8,
    maxSizeKB: 400,
    minQuality: 0.2
  },
  selfie: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.7,
    maxSizeKB: 300,
    minQuality: 0.2
  }
};

/**
 * Helper to convert a Canvas element to a File object with specific quality
 */
const getFileFromCanvas = (
  canvas: HTMLCanvasElement,
  type: string,
  name: string,
  quality: number
): Promise<File> => {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(new File([], name, { type }));
        } else {
          resolve(new File([blob], name, { type, lastModified: Date.now() }));
        }
      },
      type,
      quality
    );
  });
};

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Supports size constraints (maxSizeKB) with adaptive quality reduction.
 * Includes early-return optimization.
 */
export const compressImage = (file: File, options: CompressOptions = {}): Promise<File> => {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.7,
    maxSizeKB,
    minQuality = 0.2
  } = options;

  // 1. Validation: only compress image files
  if (!file.type.startsWith("image/")) {
    return Promise.resolve(file);
  }

  // 2. Early-return optimization: if size is already under target, return original
  if (maxSizeKB && file.size <= maxSizeKB * 1024) {
    return Promise.resolve(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(file); // Fallback if canvas context cannot be created
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      try {
        let currentQuality = quality;
        let compressedFile = await getFileFromCanvas(canvas, file.type, file.name, currentQuality);

        // 3. Adaptive size constraint (maxSizeKB loop)
        if (maxSizeKB) {
          const targetSize = maxSizeKB * 1024;
          while (compressedFile.size > targetSize && currentQuality > minQuality) {
            currentQuality -= 0.1;
            if (currentQuality < minQuality) {
              currentQuality = minQuality;
            }
            compressedFile = await getFileFromCanvas(canvas, file.type, file.name, currentQuality);
            if (currentQuality === minQuality) {
              break; // Reached quality floor, stop loop
            }
          }
        }

        resolve(compressedFile);
      } catch (error) {
        resolve(file); // Fallback to original file on error
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
  });
};
