// What JavaScript throws through the Python of `foreign_through.py`.
export function boom(value) {
    throw value;
}

export async function later(value) {
    await null;
    throw value;
}
