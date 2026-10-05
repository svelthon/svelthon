// A row a JavaScript library hands over that keeps data under a symbol.
export const token = Symbol('tail');
export const rows = [{ first: 10, [token]: 20 }];
