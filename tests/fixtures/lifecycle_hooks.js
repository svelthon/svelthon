// Hooks written in JavaScript, which a component binds under the names of its
// lifecycle by an import, by `=`, as props or from its `<script module>`.
import { record } from './lifecycle_log.js';

export function on_mount() {
    record('mount');

    return () => record('cleanup');
}

export function on_destroy() {
    record('destroy');
}

export default { on_mount, on_destroy };
