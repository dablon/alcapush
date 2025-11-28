/**
 * Merge multiple diffs into chunks that fit within maxLength
 */
export const mergeDiffs = (
    diffs: string[],
    maxLength: number
): string[] => {
    const merged: string[] = [];
    let current = '';

    for (const diff of diffs) {
        if (current.length + diff.length <= maxLength) {
            current += diff;
        } else {
            if (current) merged.push(current);
            current = diff;
        }
    }

    if (current) merged.push(current);
    return merged;
};
