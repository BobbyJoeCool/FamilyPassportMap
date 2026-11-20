import crypto from "node:crypto";

// A software passkey "device" for tests: it holds a real P-256 key pair and produces genuine WebAuthn
// answers (a "none" attestation when creating, an ECDSA signature when signing in), so the server's
// real @simplewebauthn checks run end to end. Only the parts of CBOR and WebAuthn's byte formats
// that a passkey needs are implemented here.

/**
 * Base64url without padding, as WebAuthn's JSON uses.
 * @param bytes - the bytes.
 * @returns the text.
 */
function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/**
 * A CBOR header: major type plus length (only the sizes a passkey needs).
 * @param major - CBOR major type (0 uint, 1 negative int, 2 bytes, 3 text, 5 map).
 * @param length - the value or length.
 * @returns the header bytes.
 */
function cborHeader(major: number, length: number): Buffer {
  // Small values fit in the first byte; bigger ones follow in 1 or 2 bytes.
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 256) return Buffer.from([(major << 5) | 24, length]);
  return Buffer.from([(major << 5) | 25, length >> 8, length & 0xff]);
}

/**
 * Encodes a value as CBOR: integers, byte strings, text and maps (Map or plain object).
 * @param value - the value.
 * @returns the encoding.
 */
function cbor(value: unknown): Buffer {
  // Non-negative and negative integers.
  if (typeof value === "number") return value >= 0 ? cborHeader(0, value) : cborHeader(1, -1 - value);
  // Byte strings.
  if (value instanceof Uint8Array) return Buffer.concat([cborHeader(2, value.length), Buffer.from(value)]);
  // Text strings.
  if (typeof value === "string") {
    const bytes = Buffer.from(value, "utf8");
    return Buffer.concat([cborHeader(3, bytes.length), bytes]);
  }
  // Maps, from a Map (any keys) or a plain object (text keys), each entry key then value.
  const entries = value instanceof Map ? [...value.entries()] : Object.entries(value as object);
  return Buffer.concat([cborHeader(5, entries.length), ...entries.flatMap(([key, entry]) => [cbor(key), cbor(entry)])]);
}

/**
 * SHA-256.
 * @param data - the bytes.
 * @returns the digest.
 */
function sha256(data: Uint8Array | string): Buffer {
  return crypto.createHash("sha256").update(data).digest();
}

/**
 * A 4-byte big-endian sign counter.
 * @param counter - the count.
 * @returns the bytes.
 */
function counterBytes(counter: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(counter);
  return bytes;
}

/** Flags in authenticator data: user present, user verified, attested credential data included. */
const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_AT = 0x40;

/** A software passkey device for one site. */
export class SoftwareAuthenticator {
  readonly credentialId = crypto.randomBytes(16);
  private readonly keys = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  private userHandle = new Uint8Array();
  /** The sign counter, incremented on every sign-in like a real device's. */
  counter = 0;
  private readonly rpId: string;
  private readonly origin: string;

  /**
   * @param origin - the site's origin (the RP id is its hostname).
   */
  constructor(origin: string) {
    this.origin = origin;
    this.rpId = new URL(origin).hostname;
  }

  /** The credential id as WebAuthn JSON carries it. */
  get id(): string {
    return b64url(this.credentialId);
  }

  /**
   * clientDataJSON for a ceremony, as a browser builds it.
   * @param type - "webauthn.create" or "webauthn.get".
   * @param challenge - the server's challenge.
   * @param origin - the origin to claim (tests can lie).
   * @returns the encoded bytes.
   */
  private clientData(type: string, challenge: string, origin: string): Buffer {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  /**
   * The answer to `navigator.credentials.create()`: a new passkey with a "none" attestation.
   * @param options - the server's registration options (challenge, user).
   * @param overrides - a different origin, to test refusals.
   * @returns RegistrationResponseJSON.
   */
  createResponse(options: { challenge: string; user: { id: string } }, overrides: { origin?: string } = {}) {
    this.userHandle = Buffer.from(options.user.id, "base64url");
    const jwk = this.keys.publicKey.export({ format: "jwk" });
    // The public key in COSE form: EC2 key type, ES256, curve P-256, then x and y.
    const coseKey = cbor(
      new Map<number, unknown>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(jwk.x!, "base64url")],
        [-3, Buffer.from(jwk.y!, "base64url")],
      ]),
    );
    const credentialIdLength = Buffer.alloc(2);
    credentialIdLength.writeUInt16BE(this.credentialId.length);
    const authData = Buffer.concat([
      sha256(this.rpId),
      Buffer.from([FLAG_UP | FLAG_UV | FLAG_AT]),
      counterBytes(this.counter),
      Buffer.alloc(16), // AAGUID: all zeros, as a "none" attestation allows
      credentialIdLength,
      this.credentialId,
      coseKey,
    ]);
    const attestationObject = cbor({ fmt: "none", attStmt: new Map(), authData });
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: {
        clientDataJSON: b64url(this.clientData("webauthn.create", options.challenge, overrides.origin ?? this.origin)),
        attestationObject: b64url(attestationObject),
        transports: ["internal"],
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }

  /**
   * The answer to `navigator.credentials.get()`: a signature over the challenge.
   * @param options - the server's sign-in options (challenge).
   * @param overrides - a fixed counter (to test a counter going backwards).
   * @returns AuthenticationResponseJSON.
   */
  getResponse(options: { challenge: string }, overrides: { counter?: number } = {}) {
    // A real device counts up on every use.
    this.counter = overrides.counter ?? this.counter + 1;
    const authData = Buffer.concat([sha256(this.rpId), Buffer.from([FLAG_UP | FLAG_UV]), counterBytes(this.counter)]);
    const clientDataJSON = this.clientData("webauthn.get", options.challenge, this.origin);
    // ECDSA over authenticator data followed by the hash of the client data (DER-encoded, as WebAuthn wants).
    const signature = crypto.sign("sha256", Buffer.concat([authData, sha256(clientDataJSON)]), this.keys.privateKey);
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authData),
        signature: b64url(signature),
        userHandle: b64url(this.userHandle),
      },
      clientExtensionResults: {},
    };
  }
}
