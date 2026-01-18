/**
 * Sliding Window Utilities
 *
 * TypeScript implementation matching the Python reference in python/sliding_window_viz_3d.py
 */

export interface VolumeShape {
  frames: number
  height: number
  width: number
}

export interface Position3D {
  frame: number
  height: number
  width: number
}

export interface Causal3D {
  frame: boolean
  height: boolean
  width: boolean
}

/**
 * Convert a 1D position index to 3D coordinates (frame, height, width)
 */
export function position1DTo3D(position1D: number, volumeShape: VolumeShape): Position3D {
  const { height, width } = volumeShape
  const widthIdx = position1D % width
  const heightIdx = Math.floor(position1D / width) % height
  const frameIdx = Math.floor(position1D / (width * height))
  return { frame: frameIdx, height: heightIdx, width: widthIdx }
}

/**
 * Convert 3D coordinates to a 1D position index
 */
export function position3DTo1D(position3D: Position3D, volumeShape: VolumeShape): number {
  const { height, width } = volumeShape
  return position3D.frame * (height * width) + position3D.height * width + position3D.width
}

/**
 * Get all 3D positions within a sliding window centered at the given position
 */
export function getWindows3D(
  position3D: Position3D,
  volumeShape: VolumeShape,
  windowSize: Position3D,
  causal: Causal3D = { frame: false, height: false, width: false }
): Position3D[] {
  const frameStart = Math.max(position3D.frame - windowSize.frame, 0)
  const heightStart = Math.max(position3D.height - windowSize.height, 0)
  const widthStart = Math.max(position3D.width - windowSize.width, 0)

  // Each dimension can be independently causal
  const frameEnd = causal.frame
    ? position3D.frame + 1
    : Math.min(position3D.frame + 1 + windowSize.frame, volumeShape.frames)

  const heightEnd = causal.height
    ? position3D.height + 1
    : Math.min(position3D.height + 1 + windowSize.height, volumeShape.height)

  const widthEnd = causal.width
    ? position3D.width + 1
    : Math.min(position3D.width + 1 + windowSize.width, volumeShape.width)

  const results: Position3D[] = []
  for (let f = frameStart; f < frameEnd; f++) {
    for (let h = heightStart; h < heightEnd; h++) {
      for (let w = widthStart; w < widthEnd; w++) {
        results.push({ frame: f, height: h, width: w })
      }
    }
  }
  return results
}

/**
 * Generate a binary attention mask matrix for 3D sliding window attention
 */
export function getSlidingWindowMask3D(
  volumeShape: VolumeShape,
  windowSize: Position3D,
  causal: Causal3D = { frame: false, height: false, width: false }
): boolean[][] {
  const totalTokens = volumeShape.frames * volumeShape.height * volumeShape.width

  // Initialize mask matrix with false
  const mask: boolean[][] = Array.from({ length: totalTokens }, () =>
    Array(totalTokens).fill(false)
  )

  // For each query position
  for (let position1D = 0; position1D < totalTokens; position1D++) {
    // Convert to 3D coordinates
    const position3D = position1DTo3D(position1D, volumeShape)

    // Get all key positions within the sliding window
    const windowPositions3D = getWindows3D(position3D, volumeShape, windowSize, causal)

    // Mark visible positions in the mask
    for (const kvPosition3D of windowPositions3D) {
      const kvPosition1D = position3DTo1D(kvPosition3D, volumeShape)
      mask[position1D][kvPosition1D] = true
    }
  }

  return mask
}
