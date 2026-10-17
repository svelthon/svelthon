// The compiler, imported by a page as a playground imports it: a bundle that
// holds it holds the engine too, and the engine must still start first.
import { compile } from 'svelthon/compile';

export const compiled = (source) => compile(source, 'Probe', 'probe.py', { plain: true }).script.length;
