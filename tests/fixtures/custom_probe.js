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

    get hidden() {
        return this.held?.hidden;
    }

    set hidden(value) {
        this.held = { ...this.held, hidden: value };
    }

    get payload() {
        return this.held?.payload;
    }

    set payload(value) {
        this.held = { ...this.held, payload: value };
    }
}

if (!customElements.get('svelthon-probe')) customElements.define('svelthon-probe', Probe);

export const PROBE = 'svelthon-probe';
