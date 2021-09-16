/**
 * @param url
 * @returns {Promise<{width: number, height: number}>}
 */
export function get_image_natural_wh(url) {
  return new Promise((resolve) => {
    const img = new Image();

    img.src = url;
    img.onload = () => {
      return resolve({ naturalWidth: img.width, naturalHeight: img.height });
    };
    img.onerror = () => {
      return resolve({ naturalWidth: 0, naturalHeight: 0 });
    };
  });
}
