export type Brand<Value, Name extends string> = Value & { readonly __brand: Name };
export type EntityId<Name extends string> = Brand<string, `${Name}Id`>;
