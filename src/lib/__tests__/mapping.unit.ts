import test from "ava";
import { removeEmptyObjects } from "../mappings.js";

test("should return undefined for empty object", (t) => {
  const input = {};
  t.is(removeEmptyObjects(input), undefined);
});

test("should return undefined for object with only a nested empty object", (t) => {
  const input = {
    a: {},
  };
  t.deepEqual(removeEmptyObjects(input), undefined);
});

test("should return undefined for object with only a deeply nested empty object", (t) => {
  const input = {
    a: {
      b: {
        c: {},
      }
    },
  };
  t.deepEqual(removeEmptyObjects(input), undefined);
});

test("should _only_ remove empty nested objects", (t) => {
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

test("should remove nested empty array objects from array", (t) => {
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
    c: [],
    d: {
      foo: "value",
      baz: {
        qux: 1,
      },
      yolo: true,
    },
    e: [
      {
        notEmpty: true,
      },
    ],
    f: [],
    g: null,
    h: {
      someDate,
      nestedNull: null,
    },
  });
});