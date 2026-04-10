# Connection Handles — Issues Tracker

## Status: ✅ All Issues Fixed (Round 2)

---

### Issue 1: Connection dots only show in Select tool ✅ (Fixed Round 1)
**Fix:** Removed path whitelist — dots render in any tool mode.

### Issue 2: Dashed preview line instead of actual arrow ✅ (Fixed Round 1)
**Fix:** Solid `<line>` + `<polygon>` SVG arrowhead.

### Issue 3: Connection dots disappear during drag ✅ (Fixed Round 1)
**Fix:** Dedicated `srcDotRef` for source dot + idle dots persist during drag.

### Issue 4: Dots don't show when arrow tool is selected ✅ (Fixed Round 1)
**Fix:** Same as Issue 1.

### Issue 5: Snap detection feels laggy ✅ (Fixed Round 1 + Round 2)
**Round 1:** rAF throttling + hash diffing.
**Round 2:** Element caching (no DOM rebuild), rAF on store + pointermove.

### Issue 6: Arrow doesn't activate on dot click ✅ (Fixed Round 1 + Round 2)
**Round 1:** Solid arrow preview.
**Round 2:** Pointer capture ensures reliable drag lifecycle.

---

### Issue 7: Snapping not working ✅ (Fixed Round 2)
**Root cause:** `editor.screenToPage()` was being called with container-relative coords (`clientX - rect.left`) but it expects raw `clientX/clientY`. This double-subtracted the container offset, producing wrong page coordinates → snap distance check always failed.
**Fix:** Pass `e.clientX, e.clientY` directly to `editor.screenToPage()`.

### Issue 8: Dots motion is snappy when moving objects ✅ (Fixed Round 2)
**Root cause:** `idleRef.current.innerHTML = ''` destroyed ALL dot elements every frame and recreated them from scratch. DOM thrashing caused visible flicker/"snappy" motion instead of smooth following.
**Fix:** Dot element cache (`dotElems` Map keyed by `shapeId:side`). Existing elements get their CSS `left/top` updated in-place. Only truly new dots get created, stale dots get removed.

### Issue 9: Mouse release doesn't end drawing ✅ (Fixed Round 2)
**Root cause:** Listeners were added to `window` via `addEventListener`, but the dot element was destroyed on drag start (`innerHTML = ''`). tldraw's canvas underneath then captured subsequent pointer events, stealing `pointerup` from `window`.
**Fix:** Use `setPointerCapture(pointerId)` on the overlay div. Move/up/lostcapture listeners are attached to the overlay div via `useEffect` (persistent, no stale closures). Overlay `pointerEvents` set to `'all'` during drag, `'none'` when idle.

### Issue 10: Arrow line doesn't snap to link point visually ✅ (Fixed Round 2)
**Root cause:** Same as Issue 7 — wrong page coordinates meant snap never triggered, so the line endpoint never jumped to the snap point.
**Fix:** With correct `screenToPage` coords, `findSnap()` properly detects nearby link points. When snapped, the SVG line endpoint is set to `p2v(snap.x, snap.y)` (the link point in viewport coords) and turns green.

---

## Completion Checklist
- [x] Issue 1: Dots show for all tools
- [x] Issue 2: Solid arrow preview with arrowhead
- [x] Issue 3: Source dot stays visible during drag
- [x] Issue 4: Dots show with arrow tool
- [x] Issue 5: Smooth performance (element caching + rAF)
- [x] Issue 6: Arrow activation feel
- [x] Issue 7: Snap detection works (correct screenToPage coords)
- [x] Issue 8: Smooth dot following (element cache, no innerHTML rebuild)
- [x] Issue 9: Mouse release ends drawing (pointer capture on overlay)
- [x] Issue 10: Arrow line snaps visually to link points
