// A JavaScript library on the other side of a Python call: it keeps the callback
// it is handed, and gives it back when asked.
//
// Read from here rather than from a return value, so what the test measures is
// the value the *argument* boundary produced. Handing it back through Python
// would put a second crossing between the defect and the assertion.
let held;

export const keep = (value) => {
    held = value;
};

export const taken = () => held;
