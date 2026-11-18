// A queue of tickets, each read taking the next one: a value with a side effect,
// as a bind:group evaluates it.
export const tickets = {
    taken: 0,
    next() {
        return 'ABCDEFGH'[this.taken++];
    },
    reset() {
        this.taken = 0;
    }
};
