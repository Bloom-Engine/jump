# Perry Bug: Module-level array reads with loop index return stale/wrong values in nested functions

## Summary

When reading elements from a module-level `const` array using a loop index variable (`arr[i]`) inside a function called from the main game loop, the values returned are incorrect (often 0 or stale). The same array read with a hardcoded index or a non-loop variable works correctly.

## Perry Version

v0.4.23

## Reproduction

```typescript
// Module-level arrays
const CX: number[] = [];
const CY: number[] = [];
const CT: number[] = [];
const CA: number[] = [];

// Pre-allocate at module level
for (let i = 0; i < 100; i = i + 1) {
  CX.push(0.0); CY.push(0.0); CT.push(0.0); CA.push(0.0);
}

// Set some values (e.g., during level loading)
CX[15] = 1824.0;
CY[15] = 384.0;
CT[15] = 20.0;
CA[15] = 1.0;

// This function is called every frame from the game loop
function drawItems(): void {
  let i = 0;
  while (i < 100) {
    if (CA[i] > 0.5) {
      const type = CT[i];
      if (type > 19.5) {
        // BUG: CX[i] and CY[i] return 0 here, even though they were set correctly
        drawRect(CX[i], CY[i], 32, 32, RED);  // Draws at (0, 0) instead of (1824, 384)
      }
    }
    i = i + 1;
  }
}

// Called from main loop
while (!windowShouldClose()) {
  // ...
  drawItems();  // Items never appear at correct positions
}
```

### What works

Reading with a hardcoded index from the same scope:
```typescript
// In the main loop directly (not a function call):
drawRect(CX[15], CY[15], 32, 32, RED);  // ✓ Draws at (1824, 384)
```

Reading from a dedicated small const array:
```typescript
const FLAG_POS = [0.0, 0.0, 0.0];
FLAG_POS[0] = 1824.0;  // Set during parsing
FLAG_POS[1] = 384.0;

// In the main loop:
drawRect(FLAG_POS[0], FLAG_POS[1], 32, 32, RED);  // ✓ Works
```

### What fails

Reading with a loop variable index from a function:
```typescript
function drawItems(): void {
  let i = 0;
  while (i < 100) {
    if (CA[i] > 0.5) {
      drawRect(CX[i], CY[i], 32, 32, RED);  // ✗ CX[i] returns 0
    }
    i = i + 1;
  }
}
```

The `continue` statement in `for` loops also appears broken — it skips the loop increment, causing infinite loops or skipped iterations:
```typescript
for (let i = 0; i < 100; i = i + 1) {
  if (CA[i] < 0.5) continue;  // ✗ Skips `i = i + 1`, gets stuck or skips items
  // ...
}
```

## Real-world impact

In a platformer game, collectible items (coins, gems, springs, flags) are stored in module-level parallel arrays (`CX[]`, `CY[]`, `CT[]`, `CA[]`). A `drawCollectibles()` function iterates these arrays with a while loop to render each active item. Despite the arrays containing correct data (verified via console.log), the function reads 0 for position values, causing all items to be invisible.

The flag entity (type 20) at array index 15 has correct values (`CX[15]=1824, CY[15]=384, CT[15]=20, CA[15]=1`) but `drawCollectibles` never renders it because `CX[i]` and `CY[i]` return 0 when `i` is a loop variable.

Similarly, `updateCollectibles()` can't detect collision with the flag because it reads wrong positions from the arrays, making the level impossible to complete.

## Workaround

Store critical entity data in small dedicated `const` arrays instead of reading from large arrays with loop indices:

```typescript
const FLAG_POS = [0.0, 0.0, 0.0]; // [x, y, active]

// Set during level parsing:
FLAG_POS[0] = ex * 32.0;
FLAG_POS[1] = ey * 32.0;
FLAG_POS[2] = 1.0;

// Read directly (no loop index):
if (FLAG_POS[2] > 0.5) {
  drawRect(FLAG_POS[0], FLAG_POS[1], 32, 32, RED);  // ✓ Works
}
```

## Likely cause

The loop index variable `i` (a local `let`) may not be correctly used as an array index operand when accessing module-level arrays from within a function. The codegen might be:
1. Caching the array base pointer but not properly offsetting by the loop variable
2. Using a stale register for the index after the loop variable is incremented
3. Not properly lifting the module-level array reference into the function's local frame when indexed by a mutable local

This is distinct from the previously reported `Array.push()` bug (fixed in v0.4.20). That bug affected mutations; this one affects *reads* with dynamic indices.
