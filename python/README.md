# Python Utilities for Sliding Window Attention

Python reference implementation for computing 3D sliding window attention masks.

## Quick Start

Run the demo to see 1D, 2D, and 3D sliding window examples:

```bash
python python/sliding_window_viz_3d.py
```

## Usage

```python
from python.sliding_window_viz_3d import get_sliding_window_mask_3d

# 16x16 image with 3x3 spatial window
volume_shape = (1, 16, 16)  # (frames, height, width)
window_size = (0, 1, 1)     # (window_frame, window_height, window_width)

mask = get_sliding_window_mask_3d(volume_shape, window_size, causal=False)
# mask[i][j] = 1 if token i can attend to token j
```

## Examples

**1D Sequence (text tokens):**
```python
volume_shape = (1, 1, 32)
window_size = (0, 0, 3)  # Each token sees 7 tokens (3 left + self + 3 right)
```

**2D Image (image patches):**
```python
volume_shape = (1, 16, 16)
window_size = (0, 1, 1)  # 3x3 spatial window (radius=1)
```

**3D Video (video frames):**
```python
volume_shape = (8, 8, 8)
window_size = (1, 1, 1)  # 3x3x3 spatiotemporal window
```

**Causal Attention (GPT-style):**
```python
volume_shape = (1, 1, 32)
window_size = (0, 0, 5)
mask = get_sliding_window_mask_3d(volume_shape, window_size, causal=True)
```

## Key Notes

- `window_size` is the **radius** in each dimension (e.g., radius=1 creates a 3x3 window)
- Coordinate system: `(frames, height, width)` matching tensor shapes `(T, H, W)`
- See code docstrings for detailed API documentation
