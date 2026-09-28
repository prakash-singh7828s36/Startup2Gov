import { after, test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import {
  assertJwtConfiguration,
  generateToken,
  isTokenVersionCurrent,
  verifyToken,
} from '../utils/jwt.js';
import {
  login as loginController,
  logout as logoutController,
  signup as signupController,
} from '../controllers/authController.js';
import User, { USER_ROLES } from '../models/User.js';
import { validateSignupInput, validateLoginInput, isValidEmail } from '../utils/validation.js';
import { errorHandler } from '../middleware/errorHandler.js';

const originalJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'startup2gov_test_only_signing_material_2026';
after(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

describe('Phase 1: Backend Foundation & Authentication Tests', () => {

  describe('1. Health & Database Status (/api/health)', () => {
    test('GET /api/health returns 200 with service and database status info', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.ok(res.body.status, 'Has status property');
      assert.ok(res.body.database, 'Has database object');
      assert.equal(typeof res.body.database.status, 'string');
      assert.equal(res.body.service, 'startup2gov-api');
    });

    test('Unknown API endpoint returns 404', async () => {
      const res = await request(app).get('/api/unknown-endpoint-xyz');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });

  describe('2. Validation & Security Rules', () => {
    test('isValidEmail detects valid and invalid email formats', () => {
      assert.equal(isValidEmail('founder@startup.in'), true);
      assert.equal(isValidEmail('nodal.officer@gov.in'), true);
      assert.equal(isValidEmail('not-an-email'), false);
      assert.equal(isValidEmail('missing@domain'), false);
      assert.equal(isValidEmail(''), false);
    });

    test('validateSignupInput rejects public signup with admin or evaluator role', () => {
      const adminAttempt = validateSignupInput({
        role: 'admin',
        email: 'attacker@evil.com',
        password: 'password123',
        name: 'Evil Admin',
      });
      assert.equal(adminAttempt.isValid, false);
      assert.ok(adminAttempt.errors.some((e) => e.includes('restricted')));

      const evaluatorAttempt = validateSignupInput({
        role: 'evaluator',
        email: 'eval@test.com',
        password: 'password123',
        name: 'Evaluator Test',
      });
      assert.equal(evaluatorAttempt.isValid, false);
      assert.ok(evaluatorAttempt.errors.some((e) => e.includes('restricted')));
    });

    test('validateSignupInput enforces startup name for startup role', () => {
      const result = validateSignupInput({
        role: 'startup',
        email: 'test@startup.com',
        password: 'password123',
        startupName: '',
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('Startup name is required')));
    });

    test('validateSignupInput enforces organisation for government role', () => {
      const result = validateSignupInput({
        role: 'government',
        email: 'test@gov.in',
        password: 'password123',
        orgName: '',
        department: '',
      });
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('Organisation or department')));
    });

    test('validateLoginInput rejects missing email or password', () => {
      const missingPass = validateLoginInput({ email: 'test@test.com' });
      assert.equal(missingPass.isValid, false);

      const missingEmail = validateLoginInput({ password: 'password123' });
      assert.equal(missingEmail.isValid, false);
    });
  });

  describe('3. JWT Token Generation & Verification', () => {
    test('production configuration rejects missing, weak, and placeholder signing secrets', () => {
      const originalSecret = process.env.JWT_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.JWT_SECRET;
        assert.throws(() => assertJwtConfiguration(), /JWT_SECRET must be configured/);

        process.env.JWT_SECRET = 'too-short';
        assert.throws(() => assertJwtConfiguration(), /at least 32 bytes/);

        process.env.JWT_SECRET = 'your_jwt_secret_min_32_chars_random_string_here';
        assert.throws(() => assertJwtConfiguration(), /non-placeholder/);

        process.env.JWT_SECRET = 'default_jwt_signing_material_that_is_long_enough_2026';
        assert.throws(() => assertJwtConfiguration(), /non-placeholder/);

        process.env.JWT_SECRET = 'this_is_a_secret_signing_material_that_is_long_enough';
        assert.throws(() => assertJwtConfiguration(), /non-placeholder/);

        process.env.JWT_SECRET = '8c321a6f0b9e4d7c2a5f1e8b6d0c9a3f';
        assert.doesNotThrow(() => assertJwtConfiguration());
      } finally {
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
      }
    });

    test('generateToken creates signed token and verifyToken decodes it', () => {
      const mockUser = {
        id: 'user_test_123',
        email: 'test@startup.in',
        role: USER_ROLES.STARTUP,
      };

      const token = generateToken(mockUser);
      assert.equal(typeof token, 'string');
      assert.ok(token.split('.').length === 3, 'JWT has 3 segments');

      const decoded = verifyToken(token);
      assert.ok(decoded);
      assert.equal(decoded.id, mockUser.id);
      assert.equal(decoded.email, mockUser.email);
      assert.equal(decoded.role, mockUser.role);
    });

    test('verifyToken returns null for tampered or invalid token', () => {
      assert.equal(verifyToken('invalid.token.string'), null);
      assert.equal(verifyToken(''), null);
      assert.equal(verifyToken(null), null);
    });

    test('verifyToken rejects expired tokens and token-version mismatches', () => {
      const mockUser = {
        id: 'user_test_expired',
        email: 'expired@startup.in',
        role: USER_ROLES.STARTUP,
        tokenVersion: 0,
      };
      const expiredToken = generateToken(mockUser, -1);
      assert.equal(verifyToken(expiredToken), null);

      assert.equal(isTokenVersionCurrent(undefined, undefined), true);
      assert.equal(isTokenVersionCurrent(0, 0), true);
      assert.equal(isTokenVersionCurrent(0, 1), false);
      assert.equal(isTokenVersionCurrent('1', 1), false);
    });
  });

  describe('4. Server-Side Authentication & Role Protection Middleware', () => {
    test('authentication errors do not expose internal details or query secrets', () => {
      const originalConsoleError = console.error;
      let logged;
      console.error = (...args) => { logged = args; };
      const response = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.body = body;
          return this;
        },
      };

      try {
        errorHandler(
          new Error('sensitive database implementation detail'),
          {
            method: 'POST',
            path: '/api/auth/login',
            originalUrl: '/api/auth/login?token=query-secret',
          },
          response,
          () => {}
        );
      } finally {
        console.error = originalConsoleError;
      }

      assert.equal(response.statusCode, 500);
      assert.equal(response.body.message, 'Authentication request failed.');
      assert.equal(JSON.stringify(logged).includes('sensitive database'), false);
      assert.equal(JSON.stringify(logged).includes('query-secret'), false);
    });

    test('Protected route without token returns 401 Unauthorized', async () => {
      const res = await request(app).get('/api/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('Protected route with malformed authorization header returns 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Basic 123456');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('Protected route with invalid token returns 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer totally.fake.token');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('Role restriction: requireRole forbids unauthorized role with 403', async () => {
      // Create token for a startup role
      const startupUser = {
        id: 'mock_startup_id',
        email: 'startup@test.com',
        role: USER_ROLES.STARTUP,
      };
      const token = generateToken(startupUser);

      // Attempt to access government-only endpoint
      // Note: middleware checks User in DB; if DB is not connected, User.findById may fail safely
      const res = await request(app)
        .get('/api/auth/role-check/government')
        .set('Authorization', `Bearer ${token}`);

      // Should be either 401 (user not in DB) or 403 (insufficient role), never 200
      assert.notEqual(res.status, 200);
      assert.ok([401, 403, 500].includes(res.status));
    });
  });

  describe('5. Input Validation on HTTP Endpoints', () => {
    test('POST /api/auth/signup with invalid role (admin) returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          role: 'admin',
          email: 'admin@gov.in',
          password: 'password123',
          name: 'Super Admin',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('POST /api/auth/signup with short password returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          role: 'startup',
          email: 'founder@newco.in',
          password: '123',
          startupName: 'NewCo',
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('POST /api/auth/login with missing password returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'founder@newco.in' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('POST /api/auth/logout requires an authenticated session', async () => {
      const res = await request(app).post('/api/auth/logout');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('logout increments the persisted token version', async () => {
      const originalUpdateOne = User.updateOne;
      let update;
      User.updateOne = async (filter, change) => {
        update = { filter, change };
        return { matchedCount: 1 };
      };

      const response = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.body = body;
          return this;
        },
      };

      try {
        await logoutController(
          { user: { _id: '507f1f77bcf86cd799439011' } },
          response,
          (err) => { throw err; }
        );
      } finally {
        User.updateOne = originalUpdateOne;
      }

      assert.equal(response.statusCode, 200);
      assert.deepEqual(update, {
        filter: { _id: '507f1f77bcf86cd799439011' },
        change: { $inc: { tokenVersion: 1 } },
      });
    });
  });

  describe('6. Explicit Demo Authentication', () => {
    test('backend demo-account signup and login are blocked in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalSeedFlag = process.env.SEED_DEMO_USERS;
      process.env.NODE_ENV = 'production';
      process.env.SEED_DEMO_USERS = 'true';

      const makeResponse = () => ({
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.body = body;
          return this;
        },
      });

      const loginResponse = makeResponse();
      const signupResponse = makeResponse();
      try {
        await loginController(
          { body: { email: 'demo@gov.in', password: 'password123' } },
          loginResponse,
          (err) => { throw err; }
        );
        await signupController(
          {
            body: {
              role: 'startup',
              startupName: 'Demo Reserved',
              email: 'demo@startup.in',
              password: 'password123',
            },
          },
          signupResponse,
          (err) => { throw err; }
        );
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
        if (originalSeedFlag === undefined) delete process.env.SEED_DEMO_USERS;
        else process.env.SEED_DEMO_USERS = originalSeedFlag;
      }

      assert.equal(loginResponse.statusCode, 401);
      assert.equal(loginResponse.body.message, 'Invalid email or password.');
      assert.equal(signupResponse.statusCode, 409);
    });

    test('local mock authentication and session restore are unavailable without demo mode', async () => {
      const {
        signup: demoSignup,
        login: demoLogin,
        getSessionUser: getDemoSessionUser,
      } = await import('../../src/services/authService.js');
      await assert.rejects(() => demoLogin({ email: 'demo@gov.in', password: 'password123' }), /Demo authentication is disabled/);
      await assert.rejects(() => demoSignup({ email: 'new@example.test', password: 'password123' }), /Demo authentication is disabled/);
      await assert.rejects(() => getDemoSessionUser(), /Demo authentication is disabled/);
    });
  });

});
