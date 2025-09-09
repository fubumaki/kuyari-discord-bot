import { encryptSecret, decryptSecret } from '@kuyari/shared/crypto';
const blob = encryptSecret('hello');
const plain = decryptSecret(blob);
if (plain !== 'hello') throw new Error('crypto roundtrip failed');
console.log('crypto OK');



