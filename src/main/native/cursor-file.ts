export interface CursorFileImage {
  png: Buffer
  width: number
  height: number
  hotspotX: number
  hotspotY: number
}

export function buildCursorFile(images: CursorFileImage[]): Buffer {
  if (images.length === 0 || images.length > 0xffff) {
    throw new Error('A cursor file needs between 1 and 65535 images.')
  }

  const headerSize = 6 + images.length * 16
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(2, 2)
  header.writeUInt16LE(images.length, 4)

  const chunks: Buffer[] = [header]
  let offset = headerSize

  images.forEach((image, index) => {
    if (image.width < 1 || image.width > 256 || image.height < 1 || image.height > 256) {
      throw new Error('Cursor images must be between 1 and 256 pixels.')
    }
    if (image.png.length === 0) {
      throw new Error('Cursor images cannot be empty.')
    }
    if (
      image.hotspotX < 0 ||
      image.hotspotX >= image.width ||
      image.hotspotY < 0 ||
      image.hotspotY >= image.height
    ) {
      throw new Error('Cursor hotspots must be inside the image.')
    }

    const entry = 6 + index * 16
    header[entry] = image.width === 256 ? 0 : image.width
    header[entry + 1] = image.height === 256 ? 0 : image.height
    header[entry + 2] = 0
    header[entry + 3] = 0
    header.writeUInt16LE(image.hotspotX, entry + 4)
    header.writeUInt16LE(image.hotspotY, entry + 6)
    header.writeUInt32LE(image.png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += image.png.length
    chunks.push(image.png)
  })

  return Buffer.concat(chunks)
}
