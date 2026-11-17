<script>
    let { data } = $props();

    // What JavaScript reads of a value, kind by kind.
    const shown = (value, seen = new Set()) => {
        if (value === null || value === undefined) return String(value);
        if (typeof value !== 'object') return `${typeof value}:${String(value)}`;
        if (seen.has(value)) return '<cycle>';
        seen.add(value);
        if (Array.isArray(value)) return `Array[${value.map((one) => shown(one, seen)).join(',')}]`;
        if (value instanceof Set) return `Set{${[...value].map((one) => shown(one, seen)).join(',')}}`;
        if (ArrayBuffer.isView(value)) return `${value.constructor.name}[${[...value]}]`;
        return `{${Object.keys(value).map((key) => `${key}:${shown(value[key], seen)}`).join(',')}}`;
    };
</script>

<p data-k="value">{shown(data.value)}</p>
