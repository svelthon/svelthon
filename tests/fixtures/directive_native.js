// A JavaScript record whose own data has a field called `ob_type`: data, not a
// Python object, and its method takes JavaScript's own number.
export const record = () => ({
    ob_type: 'business',
    measured(node, value) {
        node.textContent = value.toFixed(2);
    }
});
