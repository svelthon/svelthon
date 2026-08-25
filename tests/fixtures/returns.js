// One JavaScript function per kind of value a Python caller can get back, so a
// failure names the kind rather than the call.
export const aFloat = () => Math.SQRT2;
export const anInt = () => 42;
export const aString = () => 'from JavaScript';
export const anObject = () => ({ name: 'App.svelte', size: 3 });
export const anArray = () => [1, 2, 3];
export const aFunction = () => (n) => n * 3;
export const aPromise = () => Promise.resolve('awaited');
export const nothing = () => undefined;
