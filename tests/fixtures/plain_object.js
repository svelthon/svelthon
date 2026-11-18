// An object no state holds, which a module hands and changes in place.
export const plain = { name: 'a' };

export function rename() {
    plain.name = 'b';
}
