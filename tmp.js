const secp256k1 = require('secp256k1');
const { verifyAuthorizationSignature } = require('lnurl/lib');
const sig = '3046022100a83eeb44eeeaef075cd0cc503d4da24f221e1c71496147b76c8d7993032cac92022100e2c2172bf35586cf1fb82c0b79fca9f08945e68797f34a4f891d85a2c4bbe23e';
const k1 = 'c7bd00833bf66b33b9a7da548c54068cc7b5d2c4bb207a9d90f11817eec0f9a6';
const key = '0371cf12e0f3c376616ded62c82d28b8f993943dcee070d769867058ea68fe0405';
const signatureCheck = verifyAuthorizationSignature(sig, k1, key);
const pubKeyInSigMatchOK = (function() {
	return Buffer.from(secp256k1.ecdsaRecover(
		secp256k1.signatureImport(
			Buffer.from(sig, 'hex')
		),
		0,
		Buffer.from(k1, 'hex')
	)).toString('hex') === key;
})();
const sigImportCheckOK = Buffer.from(secp256k1.signatureExport(secp256k1.signatureImport(Buffer.from(sig, 'hex')))).toString('hex') === sig;
const keyLengthOK = key.length === 66;
// Strict DER check?
console.log({
	signatureCheck,
	pubKeyInSigMatchOK,
	keyLengthOK,
	sigImportCheckOK,
	sig,
	k1,
	key,
});
