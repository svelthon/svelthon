// Records a JavaScript library hands over, with a method that reads `this`, as
// an object literal's methods do: rows a rest takes apart, and a record whose
// own data has a field called `ob_type`, which the dot reads as JavaScript.
export const rows = [
    {
        id: 1,
        label: 'a',
        describe() {
            return this.label;
        }
    }
];

export const typed = {
    ob_type: 'business',
    label: 'b',
    describe() {
        return this.label;
    }
};
