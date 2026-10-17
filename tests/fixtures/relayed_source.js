// A JavaScript module handing on Python's functions as they are, by name and
// inside an object, beside a function of its own.
import { identity, describe, currency } from './relayed_source.py';

export { identity, describe, currency };
export const holder = { identity, describe, currency };
export const echo = (value) => value;
