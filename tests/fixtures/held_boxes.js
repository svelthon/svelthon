// What a JavaScript library does with a component it is handed: keep it in an
// object, behind a getter, deeper down, or hand it back.
export const box = (Child) => ({ Child });
export const getter = (Child) => ({
    get Child() {
        return Child;
    }
});
export const nested = (Child) => ({ inside: { Child } });
export const returned = (Child) => Child;
export const context = () => ({
    label: 'kept',
    report(value) {
        return `${this.label}:${typeof value}:${value.toFixed(2)}`;
    }
});
