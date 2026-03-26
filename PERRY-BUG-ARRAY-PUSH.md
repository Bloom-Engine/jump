# Perry Bug: Array.push() from nested function calls doesn't persist on module-level arrays

## Summary

When a module-level `const` array is modified via `.push()` from within a function that is called through 2+ levels of nesting, the pushed values are not visible after the function returns. Index assignment (`arr[i] = val`) works correctly in the same scenario.

## Perry Version

v0.4.19

## Reproduction

```typescript
// Module-level array
const TILES: number[] = [];

function innerPush(): void {
  TILES.push(42.0);
  TILES.push(99.0);
  // Inside this function, TILES.length appears to be 2
}

function outerCall(): void {
  innerPush();
  // After innerPush returns, TILES.length is still 0 from caller's perspective
}

// At module level:
outerCall();
console.log(TILES.length); // Expected: 2, Actual: 0
console.log(TILES[0]);     // Expected: 42, Actual: undefined/0
```

### What works

Direct push at module level:
```typescript
TILES.push(42.0);
console.log(TILES[0]); // 42 ✓
```

Push from a single-level function call:
```typescript
function directPush(): void {
  TILES.push(42.0);
}
directPush();
console.log(TILES[0]); // 42 ✓ (works at 1 level of nesting)
```

Index assignment from any nesting depth:
```typescript
function deepSet(): void {
  TILES[0] = 42.0;
}
function caller(): void {
  deepSet();
}
caller();
console.log(TILES[0]); // 42 ✓
```

### What fails

Push from 2+ levels of function nesting:
```typescript
function innerPush(): void {
  TILES.push(42.0);   // push appears to succeed locally
}
function outerCall(): void {
  innerPush();          // calls inner
}
outerCall();            // 2 levels deep
console.log(TILES[0]); // 0 ✗ — push was lost
```

## Real-world impact

In a platformer game, level tile data is parsed from a file. The parser function calls a sub-function (`parseTilesLine`) which pushes parsed values into a module-level `TILES` array. The call chain is:

```
module init → startLevel() → loadLevel() → loadLevelFromString() → parseTilesLine() → TILES.push(val)
```

All 900 pushed values are lost after the call chain returns. The array remains empty (filled with zeros by a fallback).

## Workaround

Pre-allocate the array at module level, then use index assignment instead of push:

```typescript
// Pre-allocate
while (TILES.length < totalTiles) TILES.push(0.0);  // done at module level or 1 deep

// In the nested parser, use index assignment
const WRITE_IDX = [0.0]; // track write position in a const array
function parseTilesLine(...): void {
  // ...
  const tidx = Math.floor(WRITE_IDX[0]);
  TILES[tidx] = parsedValue;  // ✓ index assignment works from any depth
  WRITE_IDX[0] = WRITE_IDX[0] + 1.0;
}
```

## Likely cause

Speculation: the `.push()` method may be operating on a local copy of the array's length/capacity metadata rather than the shared module-level version, so the internal length counter isn't propagated back to the caller. The underlying data buffer might be shared (since index writes work), but the array header (length, capacity) is copied into a local frame.
