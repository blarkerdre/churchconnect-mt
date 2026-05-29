# Fix: pen doesn't draw

## Cause

In `src/components/sermons/HandwritingPad.jsx`, the `drawingRef` declaration was dropped during an earlier edit. The pointer handlers still reference it, so the first tap throws `ReferenceError: drawingRef is not defined` and no stroke is recorded.

Current refs (line 16-19): `canvasRef`, `ctxRef`, `strokesRef`, `currentStrokeRef` — `drawingRef` is missing.

## Fix

Add one line back next to the other refs:

```jsx
const drawingRef = useRef(false);
```

No other changes needed.
