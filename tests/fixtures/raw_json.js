// A raw JSON text, a boxed scalar and an array whose own iterator yields other
// values, as JavaScript hands them to a module.
export const raw = JSON.rawJSON('9007199254740993');
export const boxed = new Number(0.25);
export const indexed = Object.assign([1, 2], {
    *[Symbol.iterator]() {
        yield 9;
    }
});

// And an object whose tag a getter gives, and one whose tag a proxy's trap
// gives, each changing a field when run: the serialiser runs neither.
export const tagged = { answer: 1 };
Object.defineProperty(tagged, Symbol.toStringTag, {
    get: () => {
        tagged.answer += 1;
        return 'Object';
    }
});

// And an instance whose hook gives it back, behind a proxy whose `ownKeys`
// adds a field from its second call: the serialiser calls it once. Made fresh
// at each call, so a control and a run each meet their first call.
export const pointed = () => {
    let listings = 0;
    class Point {
        constructor() {
            this.answer = 1;
        }
        toJSON() {
            return this;
        }
    }
    return new Proxy(new Point(), {
        ownKeys: (on) => {
            listings += 1;
            if (listings > 1) on.extra = 2;
            return Reflect.ownKeys(on);
        }
    });
};

const target = { answer: 1 };

export const trapped = new Proxy(target, {
    get: (on, key, receiver) => {
        if (key !== Symbol.toStringTag) return Reflect.get(on, key, receiver);
        target.answer += 1;
        return 'Object';
    }
});
