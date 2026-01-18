import { useState, useMemo, useRef, useEffect } from 'react'
import { getSlidingWindowMask3D, type VolumeShape, type Position3D, type Causal3D } from '../utils/slidingWindow'

type ViewMode = '1D Sequence' | '2D Image' | '3D Video' | '3D Volume'

const viewModeMap: Record<ViewMode, string> = {
  '1D Sequence': 'text',
  '2D Image': 'image',
  '3D Video': 'video',
  '3D Volume': 'volume'
}

const viewModeReverseMap: Record<string, ViewMode> = {
  'text': '1D Sequence',
  'image': '2D Image',
  'video': '3D Video',
  'volume': '3D Volume'
}

interface ViewConfig {
  icon: string
  label: string
  shape: number[]
  window: number[]
  dimLabels: string[]
}

type ColorScheme = 'blue' | 'grayscale' | 'green' | 'purple-orange' | 'warm'

interface ColorConfig {
  selected: string
  selectedBorder: string
  attendable: string
  attendableBorder: string
  other: string
  otherBorder: string
  selectedShadow: string
  attendableShadow: string
}

const colorSchemes: Record<ColorScheme, ColorConfig> = {
  blue: {
    selected: 'bg-blue-500',
    selectedBorder: 'border-blue-600',
    attendable: 'bg-blue-200',
    attendableBorder: 'border-blue-300',
    other: 'bg-white',
    otherBorder: 'border-gray-300',
    selectedShadow: 'shadow-[0_4px_6px_rgba(59,130,246,0.4)]',
    attendableShadow: 'shadow-[0_2px_4px_rgba(147,197,253,0.3)]'
  },
  grayscale: {
    selected: 'bg-gray-800',
    selectedBorder: 'border-gray-900',
    attendable: 'bg-gray-300',
    attendableBorder: 'border-gray-400',
    other: 'bg-white',
    otherBorder: 'border-gray-300',
    selectedShadow: 'shadow-[0_4px_6px_rgba(0,0,0,0.3)]',
    attendableShadow: 'shadow-[0_2px_4px_rgba(0,0,0,0.15)]'
  },
  green: {
    selected: 'bg-green-600',
    selectedBorder: 'border-green-700',
    attendable: 'bg-green-200',
    attendableBorder: 'border-green-300',
    other: 'bg-white',
    otherBorder: 'border-gray-300',
    selectedShadow: 'shadow-[0_4px_6px_rgba(22,163,74,0.4)]',
    attendableShadow: 'shadow-[0_2px_4px_rgba(134,239,172,0.3)]'
  },
  'purple-orange': {
    selected: 'bg-purple-600',
    selectedBorder: 'border-purple-700',
    attendable: 'bg-orange-300',
    attendableBorder: 'border-orange-400',
    other: 'bg-white',
    otherBorder: 'border-gray-300',
    selectedShadow: 'shadow-[0_4px_6px_rgba(147,51,234,0.4)]',
    attendableShadow: 'shadow-[0_2px_4px_rgba(253,186,116,0.3)]'
  },
  warm: {
    selected: 'bg-amber-700',
    selectedBorder: 'border-amber-800',
    attendable: 'bg-amber-200',
    attendableBorder: 'border-amber-300',
    other: 'bg-white',
    otherBorder: 'border-gray-300',
    selectedShadow: 'shadow-[0_4px_6px_rgba(180,83,9,0.4)]',
    attendableShadow: 'shadow-[0_2px_4px_rgba(253,230,138,0.3)]'
  }
}

const colorSchemeNames: Record<ColorScheme, string> = {
  blue: 'Blue (Default)',
  grayscale: 'Grayscale (Print)',
  green: 'Green (Eye-friendly)',
  'purple-orange': 'Purple-Orange (High Contrast)',
  warm: 'Warm (Amber)'
}

const viewConfigs: Record<ViewMode, ViewConfig> = {
  '1D Sequence': { icon: '📝', label: '1D Sequence', shape: [16], window: [2], dimLabels: ['Length'] },
  '2D Image': { icon: '🖼️', label: '2D Image', shape: [6, 6], window: [1, 1], dimLabels: ['Height', 'Width'] },
  '3D Video': { icon: '🎬', label: '3D Video', shape: [5, 5, 5], window: [1, 1, 1], dimLabels: ['Frames', 'Height', 'Width'] },
  '3D Volume': { icon: '📦', label: '3D Volume', shape: [5, 5, 5], window: [1, 1, 1], dimLabels: ['Depth', 'Height', 'Width'] }
}

export function SlidingWindowViz() {
  const getInitialState = () => {
    const urlParams = new URLSearchParams(globalThis.window.location.search)
    const modeParam = urlParams.get('mode')
    const mode = (modeParam && viewModeReverseMap[modeParam]) || '3D Video'
    const config = viewConfigs[mode]

    const shapeParam = urlParams.get('shape')?.split(',').map(Number) || config.shape
    const windowParam = urlParams.get('window')?.split(',').map(Number) || config.window
    const causalParam = urlParams.get('causal')?.split(',').map((v: string) => v === '1') || shapeParam.map(() => false)

    return {
      viewMode: mode,
      selectedToken: urlParams.get('token') ? Number(urlParams.get('token')) : null,
      shape: shapeParam,
      window: windowParam,
      causal: causalParam,
      colorScheme: (urlParams.get('color') as ColorScheme) || 'blue'
    }
  }

  const initialState = getInitialState()

  const [viewMode, setViewMode] = useState<ViewMode>(initialState.viewMode)
  const [selectedToken, setSelectedToken] = useState<number | null>(initialState.selectedToken)
  const [shape, setShape] = useState<number[]>(initialState.shape)
  const [windowSize, setWindowSize] = useState<number[]>(initialState.window)
  const [causal, setCausal] = useState<boolean[]>(initialState.causal)
  const [leftPanelWidth, setLeftPanelWidth] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [colorScheme, setColorScheme] = useState<ColorScheme>(initialState.colorScheme)
  const [showShareToast, setShowShareToast] = useState(false)
  const [maskScale, setMaskScale] = useState(1)
  const tokenGridRef = useRef<HTMLDivElement>(null)
  const maskContainerRef = useRef<HTMLDivElement>(null)

  const actualVolumeShape: VolumeShape = useMemo(() => {
    const [d0 = 1, d1 = 1, d2 = 1] = shape.length === 1 ? [1, 1, shape[0]] : shape.length === 2 ? [1, ...shape] : shape
    return { frames: d0, height: d1, width: d2 }
  }, [shape])

  const actualWindowSize: Position3D = useMemo(() => {
    const [w0 = 0, w1 = 0, w2 = 0] = windowSize.length === 1 ? [0, 0, windowSize[0]] : windowSize.length === 2 ? [0, ...windowSize] : windowSize
    return { frame: w0, height: w1, width: w2 }
  }, [windowSize])

  const actualCausal: Causal3D = useMemo(() => {
    const [c0 = false, c1 = false, c2 = false] = causal.length === 1 ? [false, false, causal[0]] : causal.length === 2 ? [false, ...causal] : causal
    return { frame: c0, height: c1, width: c2 }
  }, [causal])

  // Generate attention mask
  const attentionMask = useMemo(() => {
    return getSlidingWindowMask3D(actualVolumeShape, actualWindowSize, actualCausal)
  }, [actualVolumeShape, actualWindowSize, actualCausal])

  const totalTokens = actualVolumeShape.frames * actualVolumeShape.height * actualVolumeShape.width

  // Compute attendable tokens for the selected token
  const attendableTokens = useMemo(() => {
    if (selectedToken === null) return new Set<number>()
    const tokens = new Set<number>()
    for (let i = 0; i < totalTokens; i++) {
      if (attentionMask[selectedToken]?.[i]) {
        tokens.add(i)
      }
    }
    return tokens
  }, [selectedToken, attentionMask, totalTokens])

  // Handle resize
  const handleMouseDown = () => {
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const percentage = (e.clientX / globalThis.window.innerWidth) * 100
      setLeftPanelWidth(Math.min(Math.max(percentage, 30), 70))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleShare = async () => {
    const params = [
      `mode=${viewModeMap[viewMode]}`,
      `shape=${shape.join(',')}`,
      `window=${windowSize.join(',')}`,
      `causal=${causal.map(c => c ? '1' : '0').join(',')}`,
      selectedToken !== null ? `token=${selectedToken}` : ''
    ].filter(Boolean).join('&')

    const shareUrl = `${globalThis.window.location.origin}${globalThis.window.location.pathname}?${params}`

    try {
      await navigator.clipboard.writeText(shareUrl)
      setShowShareToast(true)
      setTimeout(() => setShowShareToast(false), 3000)
    } catch (err) {
      alert(`Share this URL:\n${shareUrl}`)
    }
  }

  const handleFitToView = () => {
    if (!maskContainerRef.current) return
    const availableWidth = maskContainerRef.current.clientWidth
    const availableHeight = maskContainerRef.current.clientHeight
    if (availableWidth === 0 || availableHeight === 0) return
    const totalTokens = actualVolumeShape.frames * actualVolumeShape.height * actualVolumeShape.width
    const BASE_CELL_SIZE = 16
    const CELL_GAP = 1
    const canvasWidth = totalTokens * (BASE_CELL_SIZE + CELL_GAP) - CELL_GAP
    const canvasHeight = totalTokens * (BASE_CELL_SIZE + CELL_GAP) - CELL_GAP
    const scaleX = availableWidth / canvasWidth
    const scaleY = availableHeight / canvasHeight
    const fitScale = Math.min(scaleX, scaleY, 1)
    setMaskScale(fitScale)
  }

  const handleReset = () => setMaskScale(1)
  const handleZoomIn = () => setMaskScale(Math.min(maskScale * 1.2, 3))
  const handleZoomOut = () => setMaskScale(Math.max(maskScale / 1.2, 0.1))

  // Auto-scroll left panel to selected token
  useEffect(() => {
    if (selectedToken === null || !tokenGridRef.current) return

    const tokenElement = tokenGridRef.current.querySelector(`[data-token-id="${selectedToken}"]`)
    if (tokenElement) {
      tokenElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedToken])

  return (
    <div
      className="w-screen h-screen flex flex-col bg-white text-gray-800 font-sans overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Token Visualization */}
        <div className="flex flex-col p-8 overflow-hidden" style={{ width: `${leftPanelWidth}%` }}>
          {/* Fixed Header Section */}
          <div className="mb-2 flex items-center justify-between gap-4">
            <h1 className="m-0 text-2xl font-bold text-gray-900">3D Sliding Window Visualization</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href="https://github.com/niyunsheng/sliding-window-viz-3D"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white no-underline rounded-md font-medium text-sm transition-all hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-md"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="w-4 h-4">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                </svg>
                <span>Star on GitHub</span>
              </a>
              <a
                href="https://github.com/niyunsheng/sliding-window-viz-3D/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 no-underline rounded-md font-medium text-sm border border-gray-300 transition-all hover:bg-gray-50 hover:border-gray-400"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="w-4 h-4">
                  <path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path>
                  <path fillRule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"></path>
                </svg>
                <span>Report Issue</span>
              </a>
            </div>
          </div>

          {/* Fixed View Mode Selector - Radio Button Group */}
          <div className="flex gap-2">
            {(Object.keys(viewConfigs) as ViewMode[]).map((mode) => {
              const config = viewConfigs[mode]
              return (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode)
                    setSelectedToken(null)
                    setShape(viewConfigs[mode].shape)
                    setWindowSize(viewConfigs[mode].window)
                    setCausal(viewConfigs[mode].shape.map(() => false))
                  }}
                  className={`flex-1 px-4 py-3 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                    viewMode === mode
                      ? 'bg-blue-500 text-white shadow-md border-2 border-blue-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
                  }`}
                >
                  <span className="text-lg">{config.icon}</span>
                  <span>{config.label}</span>
                </button>
              )
            })}
          </div>

          {/* Fixed Mode-specific Controls */}
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-600">Shape:</span>
              {viewConfigs[viewMode].dimLabels.map((label, i) => (
                <label key={i} className="flex items-center gap-1">
                  <span className="text-gray-700">{label}</span>
                  <input
                    type="number"
                    value={shape[i] || 1}
                    onChange={(e) => {
                      const newShape = [...shape]
                      newShape[i] = Math.max(1, Number(e.target.value))
                      setShape(newShape)
                    }}
                    className="w-12 px-1.5 py-0.5 border border-gray-300 rounded text-sm bg-white"
                    min="1"
                  />
                </label>
              ))}
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-600">Window:</span>
              {viewConfigs[viewMode].dimLabels.map((label, i) => (
                <label key={i} className="flex items-center gap-1">
                  <span className="text-gray-700">{label}</span>
                  <input
                    type="number"
                    value={windowSize[i] || 0}
                    onChange={(e) => {
                      const newWindow = [...windowSize]
                      newWindow[i] = Math.max(0, Number(e.target.value))
                      setWindowSize(newWindow)
                    }}
                    className="w-12 px-1.5 py-0.5 border border-gray-300 rounded text-sm bg-white"
                    min="0"
                  />
                </label>
              ))}
            </div>
            <div className="w-px h-4 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-600">Causal:</span>
              {viewConfigs[viewMode].dimLabels.map((label, i) => (
                <label key={i} className="flex items-center gap-1 cursor-pointer">
                  <span className="text-gray-700">{label}</span>
                  <input
                    type="checkbox"
                    checked={causal[i] || false}
                    onChange={(e) => {
                      const newCausal = [...causal]
                      newCausal[i] = e.target.checked
                      setCausal(newCausal)
                    }}
                    className="w-3.5 h-3.5 cursor-pointer accent-blue-500"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Fixed Tokens Title with Buttons */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-xl font-semibold text-gray-900">Tokens ({viewMode})</h2>
              <button
                onClick={handleShare}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all flex items-center gap-1.5 ${
                  showShareToast
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {showShareToast ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <span>Share This Configuration</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setSelectedToken(null)}
                className={`px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 hover:border-gray-400 transition-colors ${
                  selectedToken === null ? 'invisible' : ''
                }`}
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Scrollable Token Grid Area */}
          <div className="flex-1 overflow-auto mt-4 min-h-0" ref={tokenGridRef}>
            {viewMode === '1D Sequence' && (
              <TokenGrid1D
                width={actualVolumeShape.width}
                selectedToken={selectedToken}
                onSelectToken={setSelectedToken}
                attendableTokens={attendableTokens}
                colorScheme={colorScheme}
              />
            )}
            {viewMode === '2D Image' && (
              <TokenGrid2D
                height={actualVolumeShape.height}
                width={actualVolumeShape.width}
                selectedToken={selectedToken}
                onSelectToken={setSelectedToken}
                attendableTokens={attendableTokens}
                colorScheme={colorScheme}
              />
            )}
            {viewMode === '3D Video' && (
              <TokenGrid3D
                volumeShape={actualVolumeShape}
                selectedToken={selectedToken}
                onSelectToken={setSelectedToken}
                attendableTokens={attendableTokens}
                colorScheme={colorScheme}
                dimensionLabel="Frame"
              />
            )}
            {viewMode === '3D Volume' && (
              <TokenGrid3D
                volumeShape={actualVolumeShape}
                selectedToken={selectedToken}
                onSelectToken={setSelectedToken}
                attendableTokens={attendableTokens}
                colorScheme={colorScheme}
                dimensionLabel="Depth"
              />
            )}
            <p className="m-0 text-sm text-gray-600 text-center mt-4">Click a token to see its attention pattern</p>
          </div>

          {/* Fixed Bottom Section */}
          <div className="pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-700 m-0 leading-relaxed">
                <span className="font-semibold text-blue-900">Why this tool?</span> While 1D sliding window is intuitive, 2D/3D cases are tricky—spatially adjacent tokens may be far apart in memory. This visualization clarifies the mapping.
              </p>
            </div>
          </div>
        </div>

        {/* Resizable Divider */}
        <div
          className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors"
          onMouseDown={handleMouseDown}
        />

        {/* Right: Attention Mask */}
        <div className="flex flex-col gap-4 pt-8 px-8 pb-4 overflow-hidden" style={{ width: `${100 - leftPanelWidth}%` }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="m-0 text-xl font-semibold text-gray-900">Attention Mask ({totalTokens} × {totalTokens})</h2>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className={`w-4 h-4 rounded border ${colorSchemes[colorScheme].selectedBorder} ${colorSchemes[colorScheme].selected}`}></div>
                  <span className="text-gray-600">Selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-4 h-4 rounded border ${colorSchemes[colorScheme].attendableBorder} ${colorSchemes[colorScheme].attendable}`}></div>
                  <span className="text-gray-600">Attendable</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-4 h-4 rounded border ${colorSchemes[colorScheme].otherBorder} ${colorSchemes[colorScheme].other}`}></div>
                  <span className="text-gray-600">Other</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-600">Color Scheme:</label>
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm bg-white cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(colorSchemeNames) as ColorScheme[]).map((scheme) => (
                  <option key={scheme} value={scheme}>
                    {colorSchemeNames[scheme]}
                  </option>
                ))}
              </select>
              <button
                onClick={handleFitToView}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 hover:border-gray-400 transition-colors"
                title="Fit to view"
              >
                Fit
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 hover:border-gray-400 transition-colors"
                title="Reset to default size"
              >
                Reset
              </button>
              <button
                onClick={handleZoomIn}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 hover:border-gray-400 transition-colors"
                title="Zoom in"
              >
                +
              </button>
              <button
                onClick={handleZoomOut}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 hover:border-gray-400 transition-colors"
                title="Zoom out"
              >
                −
              </button>
              <span className="text-sm text-gray-600">{Math.round(maskScale * 100)}%</span>
            </div>
          </div>
          <AttentionMaskView
            mask={attentionMask}
            selectedToken={selectedToken}
            onSelectToken={setSelectedToken}
            totalTokens={totalTokens}
            colorScheme={colorScheme}
            scale={maskScale}
            containerRef={maskContainerRef}
          />
        </div>
      </div>
    </div>
  )
}

// Unified Token Grid - used for all modes
function TokenGrid({
  height,
  width,
  tokenOffset = 0,
  selectedToken,
  onSelectToken,
  attendableTokens,
  colorScheme
}: {
  height: number
  width: number
  tokenOffset?: number
  selectedToken: number | null
  onSelectToken: (token: number) => void
  attendableTokens: Set<number>
  colorScheme: ColorScheme
}) {
  const colors = colorSchemes[colorScheme]

  return (
    <div
      className="grid gap-1 p-4 bg-gray-50 border border-gray-200 rounded-lg mx-auto"
      style={{
        gridTemplateColumns: `repeat(${width}, 40px)`,
        gridTemplateRows: `repeat(${height}, 40px)`
      }}
    >
      {Array.from({ length: height * width }).map((_, i) => {
        const tokenIndex = tokenOffset + i
        const isSelected = selectedToken === tokenIndex
        const isAttendable = attendableTokens.has(tokenIndex) && !isSelected

        return (
          <div
            key={i}
            data-token-id={tokenIndex}
            className={`w-10 h-10 flex items-center justify-center border rounded cursor-pointer transition-all text-xs font-medium ${
              isSelected
                ? `${colors.selected} ${colors.selectedBorder} text-white ${colors.selectedShadow}`
                : isAttendable
                ? `${colors.attendable} ${colors.attendableBorder} text-gray-900 ${colors.attendableShadow}`
                : `${colors.other} ${colors.otherBorder} text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:scale-105 hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)]`
            }`}
            onClick={() => onSelectToken(tokenIndex)}
          >
            {tokenIndex}
          </div>
        )
      })}
    </div>
  )
}

// 1D Token Grid
function TokenGrid1D({
  width,
  selectedToken,
  onSelectToken,
  attendableTokens,
  colorScheme
}: {
  width: number
  selectedToken: number | null
  onSelectToken: (token: number) => void
  attendableTokens: Set<number>
  colorScheme: ColorScheme
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <TokenGrid
        height={1}
        width={width}
        selectedToken={selectedToken}
        onSelectToken={onSelectToken}
        attendableTokens={attendableTokens}
        colorScheme={colorScheme}
      />
    </div>
  )
}

// 2D Token Grid
function TokenGrid2D({
  height,
  width,
  selectedToken,
  onSelectToken,
  attendableTokens,
  colorScheme
}: {
  height: number
  width: number
  selectedToken: number | null
  onSelectToken: (token: number) => void
  attendableTokens: Set<number>
  colorScheme: ColorScheme
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <TokenGrid
        height={height}
        width={width}
        selectedToken={selectedToken}
        onSelectToken={onSelectToken}
        attendableTokens={attendableTokens}
        colorScheme={colorScheme}
      />
    </div>
  )
}

// 3D Token Grid (showing all frames with flex-wrap)
function TokenGrid3D({
  volumeShape,
  selectedToken,
  onSelectToken,
  attendableTokens,
  colorScheme,
  dimensionLabel = 'Frame'
}: {
  volumeShape: VolumeShape
  selectedToken: number | null
  onSelectToken: (token: number) => void
  attendableTokens: Set<number>
  colorScheme: ColorScheme
  dimensionLabel?: string
}) {
  const { frames, height, width } = volumeShape

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {Array.from({ length: frames }).map((_, frameIdx) => {
        const frameOffset = frameIdx * height * width
        return (
          <div key={frameIdx}>
            <div className="text-xs font-semibold text-gray-600 mb-0.5 text-center">
              {dimensionLabel} {frameIdx}
            </div>
            <TokenGrid
              height={height}
              width={width}
              tokenOffset={frameOffset}
              selectedToken={selectedToken}
              onSelectToken={onSelectToken}
              attendableTokens={attendableTokens}
              colorScheme={colorScheme}
            />
              </div>
        )
      })}
    </div>
  )
}

// Attention Mask View - Canvas Version
function AttentionMaskView({
  mask,
  selectedToken,
  onSelectToken,
  totalTokens,
  colorScheme,
  scale,
  containerRef
}: {
  mask: boolean[][]
  selectedToken: number | null
  onSelectToken: (token: number) => void
  totalTokens: number
  colorScheme: ColorScheme
  scale: number
  containerRef: React.RefObject<HTMLDivElement>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  // Cell size and layout constants - dynamically adjust for large matrices
  // Browser canvas max size is typically 16384 or 32768 pixels
  const MAX_CANVAS_SIZE = 8192 // Conservative limit to stay well within browser limits
  const BASE_CELL_SIZE = 16
  const CELL_GAP = 1
  const ROW_LABEL_WIDTH = 30
  const COL_LABEL_HEIGHT = 24

  // Calculate cell size to fit within max canvas size
  const idealCanvasSize = totalTokens * (BASE_CELL_SIZE + CELL_GAP) - CELL_GAP
  const CELL_SIZE = idealCanvasSize > MAX_CANVAS_SIZE
    ? Math.max(1, Math.floor((MAX_CANVAS_SIZE / totalTokens) - CELL_GAP))
    : BASE_CELL_SIZE

  // Calculate display size
  const displaySize = totalTokens
  const canvasWidth = displaySize * (CELL_SIZE + CELL_GAP) - CELL_GAP
  const canvasHeight = displaySize * (CELL_SIZE + CELL_GAP) - CELL_GAP

  // Get RGB colors for the selected scheme
  const getColors = (isSelfAttention: boolean, canAttend: boolean): string => {
    if (colorScheme === 'blue') {
      if (isSelfAttention) return '#3b82f6' // blue-500
      if (canAttend) return '#bfdbfe' // blue-200
      return '#f3f4f6' // gray-100
    } else if (colorScheme === 'grayscale') {
      if (isSelfAttention) return '#1f2937' // gray-800
      if (canAttend) return '#d1d5db' // gray-300
      return '#f3f4f6' // gray-100
    } else if (colorScheme === 'green') {
      if (isSelfAttention) return '#16a34a' // green-600
      if (canAttend) return '#bbf7d0' // green-200
      return '#f3f4f6' // gray-100
    } else if (colorScheme === 'purple-orange') {
      if (isSelfAttention) return '#9333ea' // purple-600
      if (canAttend) return '#fed7aa' // orange-300
      return '#f3f4f6' // gray-100
    } else { // warm
      if (isSelfAttention) return '#b45309' // amber-700
      if (canAttend) return '#fde68a' // amber-200
      return '#f3f4f6' // gray-100
    }
  }

  // Get border color for selected row
  const getBorderColor = (): string => {
    if (colorScheme === 'blue') return '#3b82f6'
    if (colorScheme === 'grayscale') return '#1f2937'
    if (colorScheme === 'green') return '#16a34a'
    if (colorScheme === 'purple-orange') return '#9333ea'
    return '#b45309' // warm
  }

  // Draw the attention mask - only redraw when mask data changes, not on scale change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // For large canvases, skip DPR scaling to stay within browser limits
    // Browser max canvas size is typically 16384 or 32768 pixels
    const dpr = canvasWidth <= 4096 ? (window.devicePixelRatio || 1) : 1
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Draw cells
    for (let qi = 0; qi < displaySize; qi++) {
      for (let ki = 0; ki < displaySize; ki++) {
        const canAttend = mask[qi]?.[ki] ?? false
        const isSelfAttention = qi === ki && canAttend

        const x = ki * (CELL_SIZE + CELL_GAP)
        const y = qi * (CELL_SIZE + CELL_GAP)

        ctx.fillStyle = getColors(isSelfAttention, canAttend)
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
      }
    }

    // Draw row highlight border if a token is selected
    if (selectedToken !== null && selectedToken < displaySize) {
      const y = selectedToken * (CELL_SIZE + CELL_GAP)
      ctx.strokeStyle = getBorderColor()
      ctx.lineWidth = 2
      ctx.strokeRect(0, y - 1, canvasWidth, CELL_SIZE + 2)
    }

    // Draw hover highlight
    if (hoveredRow !== null && hoveredRow < displaySize) {
      const y = hoveredRow * (CELL_SIZE + CELL_GAP)
      ctx.fillStyle = 'rgba(209, 213, 219, 0.3)' // gray-300 with opacity
      ctx.fillRect(0, y, canvasWidth, CELL_SIZE)
    }
  }, [mask, selectedToken, hoveredRow, colorScheme, displaySize, canvasWidth, canvasHeight, CELL_SIZE, CELL_GAP])

  // Auto-scroll to selected token row and column (diagonal position)
  useEffect(() => {
    if (selectedToken === null || !canvasRef.current) return

    const canvasContainer = canvasRef.current.parentElement
    if (!canvasContainer) return

    // Calculate position in scaled canvas coordinates
    const cellSize = (CELL_SIZE + CELL_GAP) * scale
    const rowY = selectedToken * cellSize
    const colX = selectedToken * cellSize
    const scaledCellSize = CELL_SIZE * scale

    // Calculate the visible area
    const containerTop = canvasContainer.scrollTop
    const containerBottom = containerTop + canvasContainer.clientHeight
    const containerLeft = canvasContainer.scrollLeft
    const containerRight = containerLeft + canvasContainer.clientWidth

    const rowTop = rowY
    const rowBottom = rowY + scaledCellSize
    const colLeft = colX
    const colRight = colX + scaledCellSize

    // Calculate scroll positions
    let scrollTop = canvasContainer.scrollTop
    let scrollLeft = canvasContainer.scrollLeft

    // Check if row is not fully visible vertically
    if (rowTop < containerTop || rowBottom > containerBottom) {
      // Scroll to center the row in the viewport
      scrollTop = rowY - canvasContainer.clientHeight / 2 + scaledCellSize / 2
    }

    // Check if column (diagonal position) is not fully visible horizontally
    if (colLeft < containerLeft || colRight > containerRight) {
      // Scroll to center the column in the viewport
      scrollLeft = colX - canvasContainer.clientWidth / 2 + scaledCellSize / 2
    }

    // Perform the scroll if needed
    if (scrollTop !== canvasContainer.scrollTop || scrollLeft !== canvasContainer.scrollLeft) {
      canvasContainer.scrollTo({
        top: Math.max(0, scrollTop),
        left: Math.max(0, scrollLeft),
        behavior: 'smooth'
      })
    }
  }, [selectedToken, CELL_SIZE, CELL_GAP, scale])

  // Handle mouse move for hover and tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    const row = Math.floor(y / (CELL_SIZE + CELL_GAP))
    const col = Math.floor(x / (CELL_SIZE + CELL_GAP))

    if (row >= 0 && row < displaySize && col >= 0 && col < displaySize) {
      setHoveredRow(row)
      const canAttend = mask[row]?.[col] ?? false
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        text: `Query: ${row}, Key: ${col}, Can Attend: ${canAttend}`
      })
    } else {
      setHoveredRow(null)
      setTooltip(null)
    }
  }

  // Handle mouse leave
  const handleMouseLeave = () => {
    setHoveredRow(null)
    setTooltip(null)
  }

  // Handle click to select token
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const y = (e.clientY - rect.top) / scale

    const row = Math.floor(y / (CELL_SIZE + CELL_GAP))

    if (row >= 0 && row < displaySize) {
      onSelectToken(row)
    }
  }

  const colHeaderRef = useRef<HTMLDivElement>(null)
  const rowHeaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !colHeaderRef.current || !rowHeaderRef.current) return
    const syncScroll = () => {
      if (colHeaderRef.current) colHeaderRef.current.scrollLeft = containerRef.current!.scrollLeft
      if (rowHeaderRef.current) rowHeaderRef.current.scrollTop = containerRef.current!.scrollTop
    }
    containerRef.current.addEventListener('scroll', syncScroll)
    return () => containerRef.current?.removeEventListener('scroll', syncScroll)
  }, [])

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0">
      <div className="flex-1 bg-gray-100 border-2 border-gray-300 rounded-lg p-4 overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="flex mb-1">
            <div style={{ width: `${ROW_LABEL_WIDTH}px`, height: `${COL_LABEL_HEIGHT}px` }} className="flex-shrink-0 bg-gray-100" />
            <div ref={colHeaderRef} className="overflow-hidden" style={{ height: `${COL_LABEL_HEIGHT}px` }}>
              <div className="relative" style={{ width: `${canvasWidth * scale}px`, height: `${COL_LABEL_HEIGHT}px` }}>
                {Array.from({ length: displaySize }).map((_, i) => (
                  <div key={i} className="absolute flex items-center justify-center text-[10px] font-medium text-gray-600" style={{ width: `${CELL_SIZE * scale}px`, height: `${COL_LABEL_HEIGHT}px`, left: `${i * (CELL_SIZE + CELL_GAP) * scale}px` }}>
                    {i}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-1 min-h-0">
            <div ref={rowHeaderRef} className="mr-1 overflow-hidden flex-shrink-0" style={{ width: `${ROW_LABEL_WIDTH}px` }}>
              <div className="relative" style={{ height: `${canvasHeight * scale}px`, width: `${ROW_LABEL_WIDTH}px` }}>
                {Array.from({ length: displaySize }).map((_, i) => (
                  <div key={i} className="absolute flex items-center justify-center text-[10px] font-medium text-gray-600" style={{ height: `${CELL_SIZE * scale}px`, width: `${ROW_LABEL_WIDTH}px`, top: `${i * (CELL_SIZE + CELL_GAP) * scale}px` }}>
                    {i}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-auto" ref={containerRef}>
              <canvas
                ref={canvasRef}
                className="cursor-pointer"
                style={{
                  width: canvasWidth * scale,
                  height: canvasHeight * scale
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none z-50"
          style={{
            left: `${tooltip.x + 10}px`,
            top: `${tooltip.y + 10}px`
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
