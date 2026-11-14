export function exifOrientation(tiff, invalid) {
  if (tiff.length < 8) throw invalid();
  const little = tiff[0] === 73 && tiff[1] === 73;
  const big = tiff[0] === 77 && tiff[1] === 77;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  if ((!little && !big) || view.getUint16(2, little) !== 42) throw invalid();
  const start = view.getUint32(4, little);
  if (start < 8 || start > tiff.length - 2) throw invalid();
  const entries = view.getUint16(start, little);
  if (entries > 1024 || start + 2 + entries * 12 + 4 > tiff.length) throw invalid();
  let orientation;
  for (let i = 0; i < entries; i++) {
    const at = start + 2 + 12 * i;
    if (view.getUint16(at, little) !== 0x0112) continue;
    if (orientation !== undefined || view.getUint16(at + 2, little) !== 3
        || view.getUint32(at + 4, little) !== 1) throw invalid();
    orientation = view.getUint16(at + 8, little);
    if (orientation < 1 || orientation > 8) throw invalid();
  }
  return orientation ?? 1;
}

export function orientRgba(data, width, height, orientation) {
  if (orientation === 1) return { data, width, height };
  const swapped = orientation >= 5;
  const outWidth = swapped ? height : width, outHeight = swapped ? width : height;
  const pixels = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let dx, dy;
      switch (orientation) {
        case 2: dx = width - 1 - x; dy = y; break;
        case 3: dx = width - 1 - x; dy = height - 1 - y; break;
        case 4: dx = x; dy = height - 1 - y; break;
        case 5: dx = y; dy = x; break;
        case 6: dx = height - 1 - y; dy = x; break;
        case 7: dx = height - 1 - y; dy = width - 1 - x; break;
        case 8: dx = y; dy = width - 1 - x; break;
      }
      const from = (y * width + x) * 4, to = (dy * outWidth + dx) * 4;
      for (let c = 0; c < 4; c++) pixels[to + c] = data[from + c];
    }
  }
  return { data: pixels, width: outWidth, height: outHeight };
}
