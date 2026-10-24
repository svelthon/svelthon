// An action that keeps the function it is handed, to call it later, by the
// key its element carries.
export const saved = {};

export function keep(node, read) {
    saved[node.dataset.k] = read;
    return { destroy() {} };
}
