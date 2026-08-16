// What every compiled component imports. Order is load-bearing: globals, then
// the runtime, then boot.
import './globals.js';
import '../../vendor/brython.js';
import './boot.js';
