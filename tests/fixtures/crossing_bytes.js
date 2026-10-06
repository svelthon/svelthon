// What a Web API makes of the bytes it is handed.
let held;

export const blob_size = (bytes) => new Blob([bytes]).size;
export const decoded = (bytes) => new TextDecoder().decode(bytes);
export const keep = (bytes) => {
    held = bytes;
};
export const kept = () => held;
