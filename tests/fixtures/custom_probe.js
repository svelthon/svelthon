// A custom element whose properties keep what they are handed, as one that
// takes data does.
class Probe extends HTMLElement {
    get open() {
        return this.held?.open;
    }

    set open(value) {
        this.held = { ...this.held, open: value };
    }

    get disabled() {
        return this.held?.disabled;
    }

    set disabled(value) {
        this.held = { ...this.held, disabled: value };
    }
}

if (!customElements.get('svelthon-probe')) customElements.define('svelthon-probe', Probe);

export const PROBE = 'svelthon-probe';
