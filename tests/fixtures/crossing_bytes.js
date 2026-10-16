// What a Web API makes of the bytes it is handed.
let held;

export const blob_size = (bytes) => new Blob([bytes]).size;
export const decoded = (bytes) => new TextDecoder().decode(bytes);
export const keep = (bytes) => {
    held = bytes;
};
export const kept = () => held;

// A library that writes into the bytes it is handed and hands them back, as a
// function and as the methods of an object.
export const mutate = (bytes) => {
    bytes[0] = 120;
    return bytes;
};
export const library = { mutate, echo: (bytes) => bytes };
