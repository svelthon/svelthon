// A JavaScript service whose state may only be read once it has started, and
// a configuration whose field counts its reads.
export const reads = { service: 0, config: 0 };

class Service {
    constructor() {
        Object.defineProperty(this, 'unready', {
            enumerable: true,
            get() {
                reads.service += 1;
                throw new Error('service has not been started');
            }
        });
    }

    ping() {
        return 'ready';
    }
}

export const service = new Service();

export const config = {
    get serial() {
        return ++reads.config;
    }
};
