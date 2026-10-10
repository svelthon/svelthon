// Data a JavaScript library hands over, one field of which is spelled like
// Brython's own type mark. Nothing here is a Python object.
export const record = () => ({ ob_type: 'business', value: 42 });
export const control = () => ({ kind: 'business', value: 42 });

// The same collision on an array, which the inbound converter met one branch
// further on: an array is as free to carry a field called `ob_type` as an object
// is.
export const tagged_rows = () => {
    const tagged = [1, 2];

    tagged.ob_type = 'business';

    return tagged;
};

export const plain_rows = () => [1, 2];
