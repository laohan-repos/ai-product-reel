const END_PUNCTUATION = /[，。！？；：,.!?;:]$/;
const CLAUSE_PATTERN = /[^，。！？；：,.!?;:\n]+[，。！？；：,.!?;:]?/g;
const CONNECTORS = ['以及', '并且', '同时', '然后', '再', '和', '与'];

function characterCount(value: string) {
  return Array.from(value.replace(/\s+/g, '')).length;
}

function splitLongClause(value: string, maximumCharacters: number): string[] {
  if (characterCount(value) <= maximumCharacters) return [value];
  const characters = Array.from(value);
  const punctuation = END_PUNCTUATION.test(value) ? characters.pop() ?? '' : '';
  const core = characters.join('').trim();
  if (characterCount(core) <= maximumCharacters)
    return [`${core}${punctuation}`];

  const midpoint = Math.floor(core.length / 2);
  const candidates = CONNECTORS.flatMap((connector) => {
    const positions = [];
    let index = core.indexOf(connector);
    while (index >= 0) {
      if (index >= 5 && core.length - index >= 5) positions.push(index);
      index = core.indexOf(connector, index + connector.length);
    }
    return positions;
  });
  const connectorIndex = candidates.sort(
    (left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint),
  )[0];
  if (connectorIndex !== undefined) {
    const left = core.slice(0, connectorIndex).trim();
    const right = core.slice(connectorIndex).trim();
    return [
      ...splitLongClause(left, maximumCharacters),
      ...splitLongClause(`${right}${punctuation}`, maximumCharacters),
    ];
  }

  const partCount = Math.ceil(characterCount(core) / maximumCharacters);
  const partSize = Math.ceil(characters.length / partCount);
  const parts = [];
  for (let index = 0; index < characters.length; index += partSize)
    parts.push(characters.slice(index, index + partSize).join('').trim());
  if (punctuation && parts.length)
    parts[parts.length - 1] = `${parts[parts.length - 1]}${punctuation}`;
  return parts.filter(Boolean);
}

export function splitCaptionText(text: string, maximumCharacters = 16) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const clauses = normalized.match(CLAUSE_PATTERN) ?? [normalized];
  return clauses.flatMap((clause) =>
    splitLongClause(clause.trim(), maximumCharacters),
  );
}

export function timedCaptionItems(
  text: string,
  start: number,
  end: number,
) {
  const chunks = splitCaptionText(text);
  if (!chunks.length || end <= start) return [];
  const weights = chunks.map((chunk) =>
    Math.max(1, characterCount(chunk.replace(END_PUNCTUATION, ''))),
  );
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const duration = end - start;
  let elapsedWeight = 0;
  return chunks.map((chunk, index) => {
    const itemStart =
      index === 0
        ? start
        : start + Math.round((duration * elapsedWeight) / totalWeight);
    elapsedWeight += weights[index];
    const itemEnd =
      index === chunks.length - 1
        ? end
        : start + Math.round((duration * elapsedWeight) / totalWeight);
    return {
      start: itemStart,
      end: Math.max(itemStart + 1, itemEnd),
      text: chunk,
    };
  });
}
