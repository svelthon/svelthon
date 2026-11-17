// The value of each case from a `load()` written in JavaScript, which calls
// Python: its page reads on the server what the browser reads.
import { make } from '#lib/models.py';

export function load({ params }) {
    return { value: make(params.name) };
}
