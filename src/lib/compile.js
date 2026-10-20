// The compiler as JavaScript imports it, `svelthon/compile`: Bryntime first,
// which loads and starts the engine, then `compile.cjs`, which adds the
// parsing chain to that engine and compiles. An ES module importing a
// CommonJS one, the order a bundler keeps, as Bryntime imports the engine.
import 'bryntime';
import compiler from './compile.cjs';

export const {
    compile,
    VIRTUAL_PREFIX,
    virtualId,
    pythonModuleName,
    elementProps,
    scriptSurface,
    runningNames,
    PY_NAME,
    componentImports,
    importedNames
} = compiler;
