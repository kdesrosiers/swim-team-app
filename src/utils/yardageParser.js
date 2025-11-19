/**
 * Expand blocks (both curly brace and indentation-based)
 */
function expandYardageBlocks(text) {
  if (!text) return '';

  // First handle curly brace blocks
  let out = text;
  const bracePattern = /(\d+)\s*[xX×]\s*{([^{}]*)}/gs;

  let iterations = 0;
  const maxIterations = 10;

  while (bracePattern.test(out) && iterations < maxIterations) {
    out = out.replace(bracePattern, (_, n, inner) => {
      const times = parseInt(n, 10);
      if (!Number.isFinite(times) || times <= 0) return inner;
      const block = inner.trim();
      return Array(times).fill(block).join("\n");
    });
    bracePattern.lastIndex = 0;
    iterations++;
  }

  // Now handle indentation-based blocks
  const lines = out.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this line is a multiplier without opening brace
    const multiplierMatch = trimmed.match(/^(\d+)\s*[xX×]\s*$/);

    if (multiplierMatch) {
      const times = parseInt(multiplierMatch[1], 10);
      const indentedLines = [];

      // Get the indentation level of the current line
      const baseIndent = line.match(/^(\s*)/)[1].length;

      // Collect all following lines that are indented more than the multiplier line
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        const nextTrimmed = nextLine.trim();

        // Skip empty lines
        if (!nextTrimmed) {
          j++;
          continue;
        }

        // Get indentation of the next line
        const nextIndent = nextLine.match(/^(\s*)/)[1].length;

        // If this line is indented more than the multiplier line, it's part of the block
        if (nextIndent > baseIndent) {
          indentedLines.push(nextTrimmed); // Use trimmed version for yardage calculation
          j++;
        } else {
          // Stop when we hit a line with equal or less indentation
          break;
        }
      }

      // If we found indented lines, expand them
      if (indentedLines.length > 0 && Number.isFinite(times) && times > 0) {
        for (let t = 0; t < times; t++) {
          result.push(...indentedLines);
        }
        i = j; // Skip past the indented block
      } else {
        // No indented lines found, skip the multiplier line
        i++;
      }
    } else if (trimmed) {
      // Regular line with content, add trimmed version
      result.push(trimmed);
      i++;
    } else {
      // Empty line, skip
      i++;
    }
  }

  return result.join('\n');
}

export function parseYardage(input) {
  if (!input) return 0;

  // First expand all blocks (curly brace and indentation-based)
  const expanded = expandYardageBlocks(input);
  const lines = expanded.split('\n').filter(line => line.trim());

  let total = 0;

  const parseLine = (line) => {
    // Match format like: 3 x 100 or 4x75 Free
    const match = line.match(/^(\d+)\s*[xX×]\s*(\d+)/);
    if (match) {
      return parseInt(match[1]) * parseInt(match[2]);
    }

    // Don't count lines that are just multipliers (e.g., "2 x" without a value)
    // These are typically set indicators and shouldn't contribute to yardage
    const justMultiplier = line.match(/^(\d+)\s*[xX×]\s*$/);
    if (justMultiplier) {
      return 0;
    }

    // Match format like: 100 Free
    const single = line.match(/^(\d+)\s*\w*/);
    if (single) {
      return parseInt(single[1]);
    }

    return 0;
  };

  for (let line of lines) {
    total += parseLine(line);
  }

  return total;
}
