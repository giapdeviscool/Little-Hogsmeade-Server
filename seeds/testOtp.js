const otplib = require('otplib');
const { verifySync, generateSecret } = otplib;

const s = generateSecret();
console.log('secret:', s);

// verifySync expects (token, secret) as positional args, not an object
// Let's test both ways
try {
  const r1 = verifySync({ token: '123456', secret: s });
  console.log('verifySync({token, secret}) =>', r1, typeof r1);
} catch(e) {
  console.log('verifySync({token, secret}) threw:', e.message);
}

// Now test with authenticator
const { authenticator } = require('otplib');
const code = authenticator.generate(s);
console.log('authenticator.generate code:', code);

const r2 = authenticator.verify({ token: code, secret: s });
console.log('authenticator.verify =>', r2, typeof r2);
