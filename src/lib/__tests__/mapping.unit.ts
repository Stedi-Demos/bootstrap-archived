import test from "ava";
import { removeEmptyObjects } from "../mappings.js";

test("should return undefined for empty object", (t) => {
  const input = {};
  t.is(removeEmptyObjects(input), undefined);
});

test("should return undefined for nested empty object", (t) => {
  const input = {
    a: {},
  };
  t.deepEqual(removeEmptyObjects(input), {
    a: undefined,
  });
});

test("should return undefined for deeply nested empty object", (t) => {
  const input = {
    a: {
      b: {
        c: {},
      }
    },
  };
  t.deepEqual(removeEmptyObjects(input), {
    a: {
      b: {
        c: undefined,
      }
    }
  });
});

test("should _only_ convert empty nested objects to undefined", (t) => {
  const input = {
    a: {
      b1: "c1",
      b2: {},
      b3: true,
      b4: 4,
    }
  };
  t.deepEqual(removeEmptyObjects(input), {
    a: {
      b1: "c1",
      b2: undefined,
      b3: true,
      b4:4,
    }
  });
});

test("should return empty array unmodified", (t) => {
  const input: any[] = [];
  t.deepEqual(removeEmptyObjects(input), []);
});

test("should remove empty array items", (t) => {
  const input: any[] = [
    {
      a: "b1",
    },
    {},
  ];
  t.deepEqual(removeEmptyObjects(input), [
    {
      a: "b1",
    },
  ]);
});

test("should map nested empty array objects to undefined", (t) => {
  const input: any[] = [
    {
      a: "b1",
    },
    {
      nested: {
        array: {
          empty: {
            value: {},
          }
        }
      }
    },
  ];
  t.deepEqual(removeEmptyObjects(input), [
    {
      a: "b1",
    },
    {
      nested: {
        array: {
          empty: {
            value: undefined,
          }
        }
      }
    }
  ]);
});

test("should not remove null values", (t) => {
  const input = {
    a: null,
  }
  t.deepEqual(removeEmptyObjects(input), {
    a: null,
  });
});

test("should not remove Date values", (t) => {
  const someDate = new Date(123456);
  const input = {
    a: someDate,
  }
  t.deepEqual(removeEmptyObjects(input), {
    a: someDate,
  });
});

test("should recursively remove all nested empty objects", (t) => {
  const someDate = new Date(123456);
  const input = {
    a: "something",
    b: {},
    c: [],
    d: {
      foo: "value",
      bar: {},
      baz: {
        qux: 1,
      },
      yolo: true,
    },
    e: [
      {
        notEmpty: true,
      },
      {
        nested: {
          array: {
            empty: {
              value: {},
            }
          }
        }
      },
    ],
    f: [
      {},
      {},
    ],
    g: null,
    h: {
      someDate,
      nestedNull: null,
    },
    i: undefined,
    deeply: {
      nested: {
        empty: {
          value: {},
        }
      }
    },
  };

  const output = removeEmptyObjects(input);

  t.deepEqual(output, {
    a: "something",
    b: undefined,
    c: [],
    d: {
      foo: "value",
      bar: undefined,
      baz: {
        qux: 1,
      },
      yolo: true,
    },
    e: [
      {
        notEmpty: true,
      },
      {
        nested: {
          array: {
            empty: {
              value: undefined,
            }
          }
        }
      },
    ],
    f: [],
    g: null,
    h: {
      someDate,
      nestedNull: null,
    },
    i: undefined,
    deeply: {
      nested: {
        empty: {
          value: undefined,
        }
      }
    },
  });
});