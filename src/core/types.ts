type Brand<K, T extends string> = K & { readonly __brand: T };

export type Hash = Brand<string, "Hash">;
export type Address = Brand<string, "Address">;
export type PublicKeyHex = Brand<string, "PublicKeyHex">;
export type PrivateKeyHex = Brand<string, "PrivateKeyHex">;
export type SignatureHex = Brand<string, "SignatureHex">;

export type Amount = bigint;

export function asHash(value: string): Hash {
  return value as Hash;
}

export function asAddress(value: string): Address {
  return value as Address;
}

export function asPublicKeyHex(value: string): PublicKeyHex {
  return value as PublicKeyHex;
}

export function asPrivateKeyHex(value: string): PrivateKeyHex {
  return value as PrivateKeyHex;
}

export function asSignatureHex(value: string): SignatureHex {
  return value as SignatureHex;
}
