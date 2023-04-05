// eslint-disable-next-line @typescript-eslint/ban-types
export type NoUndefined<T> = T extends Function | Date
  ? T
  : T extends null
  ? null
  : T extends undefined
  ? never
  : T extends unknown[]
  ? ProcessArrayInternal<T>
  : {
      [K in keyof T]: T[K] extends unknown[] | undefined | null
        ? ProcessArrayInternal<T[K]>
        : T[K] extends object | null | undefined
        ? NoUndefined<T[K]>
        : T[K] extends undefined
        ? never
        : Exclude<T[K], undefined>;
    };

type ProcessArrayInternal<T extends unknown[] | undefined | null> =
  T extends (infer ArrayType)[]
    ? number extends T["length"]
      ? ArrayType extends object
        ? NoUndefined<ArrayType>[]
        : ArrayType[]
      : 1 extends T["length"]
      ? [T[0] extends object ? NoUndefined<T[0]> : T[0]]
      : 2 extends T["length"]
      ? [
          T[0] extends object ? NoUndefined<T[0]> : T[0],
          T[1] extends object ? NoUndefined<T[1]> : T[1]
        ]
      : 3 extends T["length"]
      ? [
          T[0] extends object ? NoUndefined<T[0]> : T[0],
          T[1] extends object ? NoUndefined<T[1]> : T[1],
          T[2] extends object ? NoUndefined<T[2]> : T[2]
        ]
      : 4 extends T["length"]
      ? [
          T[0] extends object ? NoUndefined<T[0]> : T[0],
          T[1] extends object ? NoUndefined<T[1]> : T[1],
          T[2] extends object ? NoUndefined<T[2]> : T[2],
          T[3] extends object ? NoUndefined<T[3]> : T[3]
        ]
      : never
    : T extends null
    ? null
    : undefined;
