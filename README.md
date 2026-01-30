# Sliding Window Visualization

[![Blog](https://img.shields.io/badge/Blog-Read%20the%20Deep%20Dive-blue?style=flat&logo=hugo)](https://niyunsheng.github.io/posts/visualizing-3d-attention-bridging-the-gap-between-1d-sequences-and-3d-space/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

An interactive visualization tool for understanding sliding window attention patterns across 1D, 2D, and 3D spaces. 🔍

**Why this tool?** While 1D sliding window is intuitive, 2D/3D cases are tricky—**spatially adjacent tokens may be far apart in memory, and memory-adjacent tokens may be far apart spatially**. This visualization clarifies the mapping and helps you design effective sparse attention patterns for multi-dimensional data like images or videos.

![demo](./assets/demo.gif)

## Attention Pattern Examples

To help build intuition, here are four different sliding window configurations with $F=7, H=W=6$:

| | |
| - | - |
| {{< figure src="./assets/3d_sliding_f_h1_w1.jpg" title="Fig. 2: Full Temporal, No Spatial (f=all, h=1, w=1)" caption="Attends to all frames in the temporal dimension, but only attends to itself in the spatial dimension." align="center" >}} | {{< figure src="./assets/3d_sliding_f1_h_w.jpg" title="Fig. 3: No Temporal, Full Spatial (f=1, h=all, w=all)" caption="Attends only to the current frame, but attends to all positions in the spatial dimension." align="center" >}} |
| {{< figure src="./assets/3d_sliding_f3_h_w.jpg" title="Fig. 4: Limited Temporal, Full Spatial (f=3, h=all, w=all)" caption="Attends to a sliding window of 3 frames (including the current frame and its neighbors), and attends to all positions in the spatial dimension." align="center" >}} | {{< figure src="./assets/3d_sliding_f3_h3_w3.jpg" title="Fig. 5: Limited Temporal, Limited Spatial (f=3, h=3, w=3)" caption="Attends to a sliding window of 3 frames and a 3×3 spatial neighborhood. This is the most localized attention pattern." align="center" >}} |


## Get Started

### Web Demo

Visit the live demo at: https://niyunsheng.github.io/sliding-window-viz-3D/

### Python

Python reference implementation is available in the `python/` directory. For algorithm implementation details, see [python/README.md](python/README.md).

### Development

```bash
npm install      # Install dependencies
npm run dev      # Start dev server
npm run build    # Build for production
npm run deploy   # Deploy to GitHub Pages
```

## Acknowledgments

Special thanks to Claude for assistance with the web visualization code.
