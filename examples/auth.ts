/**
 * examples/auth.ts
 *
 * Runnable tour of the @bloomneo/appkit/auth module.
 *
 * Covers (in order):
 *   1. Getting the singleton via authClass.get()
 *   2. Password hashing + verification
 *   3. Issuing a login token (user-facing session JWT)
 *   4. Issuing an API token (service-to-service JWT)
 *   5. Verifying a token manually
 *   6. Reading the user off a request with getUser()
 *   7. Role and permission checks
 *   8. Express middleware: requireLoginToken / requireUserRoles /
 *      requireUserPermissions / requireApiToken
 *   9. Class-level helpers: getRoles / getAllRoles / isValidRole
 *
 * Prereqs:  BLOOM_AUTH_SECRET must be set (>= 32 chars).
 * Run:      tsx examples/auth.ts
 */

import { authClass } from '../src/auth/index.js';
import type { JwtPayload } from '../src/auth/index.js';

async function main() {
  const auth = authClass.get();

  // 2. Password hashing + verification
  const hash = await auth.hashPassword('correct-horse-battery-staple');
  const ok = await auth.comparePassword('correct-horse-battery-staple', hash);
  console.log('password matches =', ok);

  // 3. Login token (short-lived user session)
  const loginToken = auth.generateLoginToken(
    { userId: 'user_123', email: 'ada@example.com', role: 'admin', level: 'tenant' },
    '2h',
  );
  console.log('login token issued (len):', loginToken.length);

  // 4. API token (machine-to-machine, typically longer-lived)
  const apiToken = auth.generateApiToken(
    { keyId: 'key_42', scope: 'read:users', role: 'admin', level: 'tenant' },
    '30d',
  );
  console.log('api token issued (len):', apiToken.length);

  // 5. Manual verification (throws TokenError on invalid/expired tokens)
  const payload: JwtPayload = auth.verifyToken(loginToken);
  console.log('verified subject =', payload);

  // 6. Reading the user off an Express-shaped request object.
  //    getUser() reads request.user / request.token, which middleware
  //    populates. Here we stage the middleware's output by verifying
  //    the token ourselves.
  const fakeReq = { user: auth.verifyToken(loginToken) } as any;
  const user = auth.getUser(fakeReq);
  console.log('getUser() →', user?.userId);

  // 7. Role + permission checks (role.level hierarchy)
  console.log(
    "hasRole('admin.tenant' >= 'user.basic') =",
    auth.hasRole('admin.tenant', 'user.basic'),
  );
  if (user) {
    console.log("hasPermission(user, 'manage:tenant') =", auth.hasPermission(user, 'manage:tenant'));
  }

  // 8. Express middleware — use these in routers, not standalone
  //
  //    router.get(
  //      '/me',
  //      auth.requireLoginToken(),                            // 401 if missing/invalid
  //      auth.requireUserRoles(['admin.tenant']),             // 403 if below role
  //      (req, res) => res.json(auth.getUser(req)),
  //    );
  //
  //    router.get('/internal/sync',
  //      auth.requireApiToken(),                              // validates API token
  //      auth.requireUserPermissions(['read:users']),
  //      handler);
  //
  //    Building the middleware stack (do not invoke — Express supplies req/res/next):
  const loginMw = auth.requireLoginToken();
  const rolesMw = auth.requireUserRoles(['admin.tenant']);
  const permsMw = auth.requireUserPermissions(['manage:tenant']);
  const apiMw   = auth.requireApiToken();
  console.log('middleware built:', [loginMw, rolesMw, permsMw, apiMw].every(m => typeof m === 'function'));

  // 9. Class-level helpers (no instance needed)
  console.log('all role.levels =', authClass.getAllRoles());
  console.log("isValidRole('admin.tenant') =", authClass.isValidRole('admin.tenant'));
  console.log("isValidRole('zzz.nope')     =", authClass.isValidRole('zzz.nope'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
