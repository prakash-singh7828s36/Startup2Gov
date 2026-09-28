import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import { ensureApplicationIndexes } from '../config/db.js';
import Application from '../models/Application.js';
import Challenge, { CHALLENGE_STATUS } from '../models/Challenge.js';
import User, { USER_ROLES } from '../models/User.js';
import { generateToken } from '../utils/jwt.js';

const testMongoUri = process.env.MONGODB_TEST_URI;
let createdUserIds = [];
let createdChallengeIds = [];

describe('Race-safe application duplicate protection (MongoDB integration)', { skip: !testMongoUri }, () => {
  before(async () => {
    await mongoose.connect(testMongoUri, {
      autoIndex: false,
      serverSelectionTimeoutMS: 5000,
    });
    await ensureApplicationIndexes();
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(() => {
    createdUserIds = [];
    createdChallengeIds = [];
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await Application.deleteMany({ user: { $in: createdUserIds } });
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdChallengeIds.length > 0) {
      await Application.deleteMany({ challenge: { $in: createdChallengeIds } });
      await Challenge.deleteMany({ _id: { $in: createdChallengeIds } });
    }
  });

  test('a second active application returns 409', async () => {
    const applicant = await createStartup();
    const challenge = await createChallenge();

    const first = await submit(applicant, challenge);
    const second = await submit(applicant, challenge);

    assert.equal(first.status, 201);
    assert.equal(second.status, 409);
    assert.equal(second.body.message, duplicateMessage);
    assert.equal(
      await Application.countDocuments({
        user: applicant.user._id,
        challengeId: String(challenge._id),
        status: { $ne: 'Withdrawn' },
      }),
      1
    );
  });

  test('concurrent attempts cannot create duplicate active applications', async () => {
    const applicant = await createStartup();
    const challenge = await createChallenge();

    const results = await Promise.all([
      submit(applicant, challenge),
      submit(applicant, challenge),
    ]);

    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    const activeCount = await Application.countDocuments({
      user: applicant.user._id,
      challengeId: String(challenge._id),
      status: { $ne: 'Withdrawn' },
    });
    assert.equal(activeCount, 1);
    assert.equal(results.find((result) => result.status === 409).body.message, duplicateMessage);
  });

  test('different startups can apply to the same challenge', async () => {
    const firstApplicant = await createStartup();
    const secondApplicant = await createStartup();
    const challenge = await createChallenge();

    const results = await Promise.all([
      submit(firstApplicant, challenge),
      submit(secondApplicant, challenge),
    ]);

    assert.deepEqual(results.map((result) => result.status), [201, 201]);
  });

  test('the same startup can apply to different challenges', async () => {
    const applicant = await createStartup();
    const firstChallenge = await createChallenge();
    const secondChallenge = await createChallenge();

    const results = await Promise.all([
      submit(applicant, firstChallenge),
      submit(applicant, secondChallenge),
    ]);

    assert.deepEqual(results.map((result) => result.status), [201, 201]);
  });

  test('withdrawn applications may be resubmitted under the existing policy', async () => {
    const applicant = await createStartup();
    const challenge = await createChallenge();
    const first = await submit(applicant, challenge);
    assert.equal(first.status, 201);

    const withdrawal = await request(app)
      .delete(`/api/applications/${first.body.application.id}`)
      .set('Authorization', `Bearer ${applicant.token}`);
    assert.equal(withdrawal.status, 200);
    assert.equal(withdrawal.body.application.status, 'Withdrawn');

    const resubmission = await submit(applicant, challenge);
    assert.equal(resubmission.status, 201);
    assert.equal(
      await Application.countDocuments({
        user: applicant.user._id,
        challengeId: String(challenge._id),
        status: { $ne: 'Withdrawn' },
      }),
      1
    );
  });
});

const duplicateMessage = 'You have already submitted an active application to this challenge.';

async function createStartup() {
  const user = await User.create({
    name: 'Integration Test Founder',
    email: `duplicate-test-${new mongoose.Types.ObjectId()}@example.test`,
    password: 'integration-test-password',
    role: USER_ROLES.STARTUP,
    startupName: 'Integration Test Startup',
  });
  createdUserIds.push(user._id);
  return { user, token: generateToken(user) };
}

async function createChallenge() {
  const challenge = await Challenge.create({
    title: `Duplicate test ${new mongoose.Types.ObjectId()}`,
    department: 'Integration Test Department',
    category: 'Technology',
    description: 'Integration test challenge for race-safe duplicate submission.',
    deadlineDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: CHALLENGE_STATUS.OPEN,
  });
  createdChallengeIds.push(challenge._id);
  return challenge;
}

function submit(applicant, challenge) {
  return request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${applicant.token}`)
    .send({
      challengeId: String(challenge._id),
      startupName: applicant.user.startupName,
      contactPerson: 'Integration Test Founder',
      solutionTitle: 'Duplicate Guard Test',
      solutionDescription: 'Testing application submission integrity under concurrent requests.',
      challengeSolution: 'A test proposal that satisfies the challenge validation requirements.',
      expectedImpact: 'Confirms database-enforced uniqueness.',
      technology: 'Node.js, MongoDB',
    });
}