// A JavaScript library that throws, with frames of its own between the throw
// and the boundary. Two of them rather than one, because the property under
// test is that the *deepest* frame stays on top: a synthesised frame would
// describe the call the component made, which is the shallow one.
export function explode() {
    inner();
}

function inner() {
    throw new TypeError('from JavaScript, not Python');
}
