# Sliding Window Visualization

An interactive visualization tool for understanding sliding window attention patterns across 1D, 2D, and 3D spaces. 🔍

**Why this tool?** While 1D sliding window is intuitive, 2D/3D cases are tricky—**spatially adjacent tokens may be far apart in memory, and memory-adjacent tokens may be far apart spatially**. This visualization clarifies the mapping and helps you design effective sparse attention patterns for multi-dimensional data like images or videos.

![demo](./assets/demo.gif)

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
