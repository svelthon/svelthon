// A JavaScript function a Python module reached for, with a name of its own.
// Python knows nothing about it — `str()` answers `<JavascriptFunction object>`
// for every one of them — so the name JavaScript gave it is what a refusal has
// to use.
export function formatted(value) {
    return String(value);
}
