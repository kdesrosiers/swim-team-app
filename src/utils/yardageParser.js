export function parseYardage(input) {
  const lines = input.split('\n').map(line => line.trim()).filter(Boolean);
  let total = 0;
  let stack = [];

  const parseLine = (line) => {
    // Match format like: 3 x 100 or 4x75 Free
    const match = line.match(/^(\d+)\s*[xX]\s*(\d+)/);
    if (match) {
      return parseInt(match[1]) * parseInt(match[2]);
    }

    // Match format like: 100 Free
    const single = line.match(/^(\d+)\s*\w*/);
    if (single) {
      return parseInt(single[1]);
    }

    return 0;
  };

  const flatten = (block) => {
    let subtotal = 0;
    for (let line of block) {
      subtotal += parseLine(line);
    }
    return subtotal;
  };

  const processStack = () => {
    const nestedBlock = [];
    while (stack.length) {
      const top = stack.pop();
      if (top === '{') break;
      nestedBlock.unshift(top);
    }

    let multiplier = 1;
    if (stack.length && stack[stack.length - 1].match(/^\d+\s*[xX]/)) {
      const m = stack.pop().match(/^(\d+)\s*[xX]/);
      if (m) multiplier = parseInt(m[1]);
    }

    return multiplier * flatten(nestedBlock);
  };

  for (let line of lines) {
    if (line.includes('{') && line.includes('}')) {
      // Handle inline block: 2 x { 3 x 100 }
      const inlineMatch = line.match(/(\d+)\s*[xX]\s*{([^}]*)}/);
      if (inlineMatch) {
        const multiplier = parseInt(inlineMatch[1]);
        const inside = inlineMatch[2].split('\n').map(s => s.trim());
        const innerYardage = inside.reduce((sum, l) => sum + parseLine(l), 0);
        total += multiplier * innerYardage;
      }
    } else if (line.includes('{')) {
      const parts = line.split('{');
      if (parts[0].trim()) stack.push(parts[0].trim());
      stack.push('{');
    } else if (line.includes('}')) {
      if (line.trim() !== '}') stack.push(line.replace('}', '').trim());
      total += processStack();
    } else {
      if (stack.length) {
        stack.push(line);
      } else {
        total += parseLine(line);
      }
    }
  }

  return total;
}
