// The values of each case from a `load()` written in JavaScript, two in an
// array and one two levels down, which a Python page reads.
import { make } from '#lib/models.py';

export function load({ params }) {
    return { items: [make(params.name), make(params.name)], deep: { value: make(params.name) } };
}
