import { enable } from '../state.js';

export function GET() {
    enable();
    return new Response('enabled');
}
