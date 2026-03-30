# Perry Bug: `arr[i]` in for-loop returns `arr[0]` for all indices (large program only)

## Summary

In the Bloom Jump game binary (~1500 lines, 30+ module-level arrays, dozens of functions), reading module-level array elements with a for-loop index (`arr[i]`) always returns the value at index 0. The loop index is ignored — every element reads as `arr[0]`.

**Cannot be reproduced in a small standalone file.** Even with identical imports, arrays, and function structure, a ~150 line repro works correctly. The bug only manifests in the full game binary, suggesting a codegen issue triggered by program size or function count.

## Perry Version

v0.4.28

## Observed behavior (in the full game)

```
// Console output from drawCollectibles function:
// Only 3 of 100 elements should be active (indices 0, 5, 15)
// Actual: ALL 100 read as active, ALL return index 0's values

draw i=0  type=10 x=256 y=384    ← correct (this IS index 0)
draw i=1  type=10 x=256 y=384    ← WRONG (should be inactive, CA[1]=0)
draw i=2  type=10 x=256 y=384    ← WRONG
...
draw i=15 type=10 x=256 y=384    ← WRONG (should be type=20 x=1824)
...
draw i=99 type=10 x=256 y=384    ← WRONG
drawCollectibles active=100       ← should be 16
```

Every `CA[i]`, `CT[i]`, `CX[i]`, `CY[i]` returns the value at index 0 regardless of `i`.

## What works

- **Direct index reads at module level**: `CA[15]` returns correct value (1.0)
- **Dedicated small arrays**: `const FLAG_POS = [0.0, 0.0, 0.0]; FLAG_POS[0]` always works
- **The same loop in a small program**: Identical code in a 150-line file with the same bloom imports works correctly
- **The same loop with fewer total module-level arrays**: Works correctly

## What fails

- `arr[i]` where `i` is a for-loop variable, inside a function, in a large program (~1500 lines)
- The function `drawCollectibles` iterates `CX[]`, `CY[]`, `CT[]`, `CA[]` (4 arrays, 100 elements each)
- Also affects `updateCollectibles`, `drawEnemies`, `updateEnemies` (same pattern)
- `continue` in the for-loop may or may not contribute

## Reproduction

The **game itself** is the only known repro. Build and run:

```bash
cd /Users/amlug/projects/bloom/jump
perry compile src/main.ts -o jump && ./jump
```

Select Level 1, walk right. No coins, gems, springs, or flag are visible (they all render at position 0,0 — off-screen or stacked). Console output confirms all array reads return index 0's values.

A standalone repro at `perry-array-bug-repro.ts` with identical arrays, imports, and function body works correctly — the bug requires the full program size to trigger.

## Likely cause

Codegen/register-allocation issue that only manifests with large programs:
- With 30+ module-level arrays and dozens of functions, the compiler may spill the array base pointer or index register incorrectly
- The for-loop index `i` (a local `let`) may lose its value after an array access or function call within the loop body
- The array load instruction may be using a fixed offset (always 0) instead of the computed index from the loop variable

## Current workaround

Store critical values in small dedicated `const` arrays (e.g., `FLAG_POS = [x, y, active]`) and read them directly without loop indexing. This works because direct `arr[N]` reads with constant or small-array indices are not affected.
