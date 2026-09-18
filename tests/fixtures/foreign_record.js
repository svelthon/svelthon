// Data a JavaScript library hands over, one field of which is spelled like
// Brython's own type mark. Nothing here is a Python object.
export const record = () => ({ ob_type: 'business', value: 42 });
export const control = () => ({ kind: 'business', value: 42 });
