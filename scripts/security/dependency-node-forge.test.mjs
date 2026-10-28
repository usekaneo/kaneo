import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

const mobileRequire = createRequire(
  new URL("../../apps/mobile/package.json", import.meta.url),
);
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
const certificatesRequire = createRequire(
  cliRequire.resolve("@expo/code-signing-certificates"),
);
const forge = certificatesRequire("node-forge");
const { privateKey: nodePrivateKey } = generateKeyPairSync("rsa", {
  modulusLength: 1024,
  publicExponent: 65537,
});
const privateKey = forge.pki.privateKeyFromPem(
  nodePrivateKey.export({ type: "pkcs1", format: "pem" }),
);
const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
const digest = forge.md.sha256
  .create()
  .update("Kaneo certificate validation regression")
  .digest()
  .getBytes();

function signedDigestInfo(withNull, withExtraElement) {
  const { asn1 } = forge;
  const universal = asn1.Class.UNIVERSAL;
  const algorithm = [
    asn1.create(
      universal,
      asn1.Type.OID,
      false,
      asn1.oidToDer(forge.pki.oids.sha256).getBytes(),
    ),
  ];
  if (withNull)
    algorithm.push(asn1.create(universal, asn1.Type.NULL, false, ""));
  if (withExtraElement)
    algorithm.push(
      asn1.create(universal, asn1.Type.OCTETSTRING, false, "unexpected"),
    );
  const info = asn1.create(universal, asn1.Type.SEQUENCE, true, [
    asn1.create(universal, asn1.Type.SEQUENCE, true, algorithm),
    asn1.create(universal, asn1.Type.OCTETSTRING, false, digest),
  ]);
  // Sign with our own private key so only DigestInfo validation is under test.
  return privateKey.sign(asn1.toDer(info).getBytes(), "NONE");
}

test("Expo's node-forge accepts valid SHA-256 DigestInfo with optional NULL", () => {
  for (const withNull of [false, true]) {
    assert.equal(
      publicKey.verify(digest, signedDigestInfo(withNull, false)),
      true,
    );
  }
});

test("Expo's node-forge rejects unconsumed nested DigestAlgorithm elements", () => {
  // Backport of https://github.com/digitalbazaar/forge/pull/1152.
  for (const withNull of [false, true]) {
    assert.throws(
      () => publicKey.verify(digest, signedDigestInfo(withNull, true)),
      /DigestInfo/,
    );
  }
});
