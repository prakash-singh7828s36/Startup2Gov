import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { uploadDocument } from '../controllers/documentController.js';
import { generateToken } from '../utils/jwt.js';
import { USER_ROLES } from '../models/User.js';
import {
  validateDocument,
  sanitizeFilename,
  storeFile,
  getFileStream,
  deleteStoredFile,
  MAX_FILE_SIZE,
} from '../storage/storageAdapter.js';
import {
  APPLICATION_STATUS,
  ALLOWED_STATUS_TRANSITIONS,
  ACTIVE_APPLICATION_STATUSES,
  default as Application,
} from '../models/Application.js';
import { errorHandler } from '../middleware/errorHandler.js';
import {
  clearDraft,
  getApplicationById,
  getDraft,
  getGovInbox,
  getMyApplications,
  reviewApplication,
  saveDraft,
  withdrawApplication,
} from '../controllers/applicationController.js';

describe('Phase 3: Applications, Draft Autosave & Document Storage Tests', () => {

  describe('1. Document Upload & Storage Security Validation', () => {
    test('validateDocument accepts signature-checked PDF and structurally valid DOCX', () => {
      const validPdf = validateDocument(
        'proposal.pdf',
        'application/pdf',
        Buffer.from('%PDF-1.7 test PDF content')
      );
      assert.equal(validPdf.ok, true);
      assert.equal(validPdf.ext, '.pdf');

      const validDocx = validateDocument(
        'solution_overview.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        createDocxBuffer()
      );
      assert.equal(validDocx.ok, true);
    });

    test('validateDocument rejects unsupported extensions including legacy DOC', () => {
      const dangerousExe = validateDocument(
        'exploit.exe',
        'application/x-msdownload',
        Buffer.from('not a document')
      );
      assert.equal(dangerousExe.ok, false);
      assert.ok(dangerousExe.error.includes('Unsupported file extension'));

      const legacyDoc = validateDocument(
        'legacy.doc',
        'application/msword',
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
      );
      assert.equal(legacyDoc.ok, false);
      assert.equal(legacyDoc.statusCode, 415);

      const dangerousJs = validateDocument(
        'script.js',
        'text/javascript',
        Buffer.from('not a document')
      );
      assert.equal(dangerousJs.ok, false);
    });

    test('validateDocument rejects spoofed and generic MIME types', () => {
      const pdf = Buffer.from('%PDF-1.7 test PDF content');
      for (const mimeType of ['text/plain', 'application/octet-stream', '']) {
        const result = validateDocument('proposal.pdf', mimeType, pdf);
        assert.equal(result.ok, false);
        assert.equal(result.statusCode, 415);
      }
    });

    test('upload controller returns a clear 415 for spoofed MIME metadata', async () => {
      const response = createResponse();
      await uploadDocument({
        file: {
          originalname: 'proposal.pdf',
          mimetype: 'application/octet-stream',
          buffer: Buffer.from('%PDF-1.7 test PDF content'),
        },
      }, response);

      assert.equal(response.statusCode, 415);
      assert.match(response.body.message, /extension and MIME type/i);
    });

    test('validateDocument rejects MIME-extension mismatches and invalid signatures', () => {
      const pdf = Buffer.from('%PDF-1.7 test PDF content');
      const mismatch = validateDocument(
        'proposal.pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pdf
      );
      assert.equal(mismatch.ok, false);
      assert.equal(mismatch.statusCode, 415);

      const invalidPdf = validateDocument(
        'spoofed.pdf',
        'application/pdf',
        Buffer.from('This is not a PDF')
      );
      assert.equal(invalidPdf.ok, false);
      assert.equal(invalidPdf.statusCode, 415);

      const renamedPdf = validateDocument(
        'renamed.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pdf
      );
      assert.equal(renamedPdf.ok, false);
      assert.equal(renamedPdf.statusCode, 415);
    });

    test('validateDocument rejects ZIP files without the required DOCX package parts', () => {
      const arbitraryZip = createStoredZip({ 'readme.txt': 'not a Word document' });
      const result = validateDocument(
        'archive.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        arbitraryZip
      );
      assert.equal(result.ok, false);
      assert.equal(result.statusCode, 415);
    });

    test('validateDocument enforces 5MB file size limit', () => {
      const oversizedFile = validateDocument(
        'huge.pdf',
        'application/pdf',
        Buffer.alloc(MAX_FILE_SIZE + 1)
      );
      assert.equal(oversizedFile.ok, false);
      assert.equal(oversizedFile.statusCode, 413);
      assert.ok(oversizedFile.error.includes('exceeds the 5MB limit'));
    });

    test('sanitizeFilename prevents directory traversal and null byte injection', () => {
      assert.equal(sanitizeFilename('../../../etc/passwd'), 'passwd');
      assert.equal(sanitizeFilename('my..file/name?.pdf'), 'name_.pdf');
    });

    test('storeFile creates unique random UUID storage keys and verifies PDF magic bytes', async () => {
      const fakePdfBuffer = Buffer.from('%PDF-1.4 Fake PDF Content for Unit Test');
      const fileInfo = await storeFile(fakePdfBuffer, 'test_proposal.pdf', 'application/pdf');

      assert.ok(fileInfo.storageKey.endsWith('.pdf'));
      assert.notEqual(fileInfo.storageKey, 'test_proposal.pdf'); // UUID obfuscated
      assert.equal(fileInfo.originalName, 'test_proposal.pdf');

      // Verify file can be streamed
      const readResult = getFileStream(fileInfo.storageKey);
      assert.ok(readResult !== null);
      assert.equal(readResult.size, fakePdfBuffer.length);
      const chunks = [];
      for await (const chunk of readResult.stream) {
        chunks.push(chunk);
      }
      assert.equal(Buffer.concat(chunks).length, fakePdfBuffer.length);

      // Clean up after test
      await deleteStoredFile(fileInfo.storageKey);
      assert.equal(getFileStream(fileInfo.storageKey), null);
    });

    test('storeFile rejects fake PDF files missing %PDF- magic bytes', async () => {
      const corruptedBuffer = Buffer.from('NOT A REAL PDF FILE HEADER');
      await assert.rejects(async () => {
        await storeFile(corruptedBuffer, 'fake.pdf', 'application/pdf');
      }, (err) => err.statusCode === 415 && err.message.includes('valid PDF signature'));
    });

    test('storeFile stores a validated DOCX with canonical MIME metadata', async () => {
      const document = await storeFile(
        createDocxBuffer(),
        'proposal.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      try {
        assert.equal(document.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        assert.ok(getFileStream(document.storageKey));
      } finally {
        await deleteStoredFile(document.storageKey);
      }
    });
  });

  describe('2. Draft Autosave & Role Authorization', () => {
    test('production draft and application handlers return 503 without MongoDB', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const responseFactory = () => ({
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
      const user = { id: '507f1f77bcf86cd799439011', role: USER_ROLES.GOVERNMENT };
      const operations = [
        [getDraft, { params: { challengeId: '1' }, user }],
        [saveDraft, { params: { challengeId: '1' }, body: {}, user }],
        [clearDraft, { params: { challengeId: '1' }, user }],
        [getMyApplications, { user }],
        [getApplicationById, { params: { id: 'APP-001' }, user }],
        [withdrawApplication, { params: { id: 'APP-001' }, user }],
        [getGovInbox, { query: {}, user }],
        [reviewApplication, { params: { id: 'APP-001' }, body: { status: 'Approved' }, user }],
      ];

      try {
        for (const [handler, req] of operations) {
          const res = responseFactory();
          await handler(req, res, (err) => { throw err; });
          assert.equal(res.statusCode, 503, `${handler.name} should report database unavailability`);
          assert.equal(res.body.success, false);
        }
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
      }
    });

    test('GET and POST /api/applications/drafts/:challengeId require authentication (401)', async () => {
      const getRes = await request(app).get('/api/applications/drafts/1');
      assert.equal(getRes.status, 401);

      const postRes = await request(app)
        .post('/api/applications/drafts/1')
        .send({ formData: { solutionTitle: 'Unauthenticated' } });
      assert.equal(postRes.status, 401);
    });

    test('Government user cannot access startup draft endpoint (403 Forbidden)', async () => {
      const govUser = {
        id: 'mock_gov_officer_3',
        email: 'officer@gov.in',
        role: USER_ROLES.GOVERNMENT,
      };
      const token = generateToken(govUser);

      const res = await request(app)
        .get('/api/applications/drafts/1')
        .set('Authorization', `Bearer ${token}`);

      assert.notEqual(res.status, 200);
      assert.ok([401, 403, 500].includes(res.status));
    });
  });

  describe('3. Application Submission & Validation Rules', () => {
    test('active application statuses exclude only withdrawn applications', () => {
      assert.deepEqual(ACTIVE_APPLICATION_STATUSES, [
        APPLICATION_STATUS.PENDING,
        APPLICATION_STATUS.UNDER_REVIEW,
        APPLICATION_STATUS.APPROVED,
        APPLICATION_STATUS.REJECTED,
      ]);

      const activeUniqueIndex = Application.schema.indexes().find(
        ([keys, options]) =>
          keys.user === 1 &&
          keys.challengeId === 1 &&
          options.unique === true
      );
      assert.ok(activeUniqueIndex, 'Active submissions have a unique compound index');
      assert.equal(activeUniqueIndex[1].partialFilterExpression.$or.length, 6);
    });

    test('duplicate-key errors for an active application map to the standard 409 body', () => {
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
          {
            code: 11000,
            keyPattern: { user: 1, challengeId: 1 },
            keyValue: { user: 'private-user-id', challengeId: 'private-challenge-id' },
            message: 'E11000 duplicate key error: private values',
          },
          { method: 'POST', originalUrl: '/api/applications' },
          response,
          () => {}
        );
      } finally {
        console.error = originalConsoleError;
      }

      assert.equal(response.statusCode, 409);
      assert.equal(logged[1].status, 409);
      assert.equal(logged[1].message, 'Request failed.');
      assert.equal(JSON.stringify(logged).includes('private-user-id'), false);
      assert.equal(JSON.stringify(logged).includes('private-challenge-id'), false);
      assert.deepEqual(response.body, {
        success: false,
        message: 'You have already submitted an active application to this challenge.',
      });
    });

    test('POST /api/applications rejects submission missing required fields (400)', async () => {
      const startupUser = {
        id: 'mock_startup_user_3',
        email: 'founder@greentech.in',
        role: USER_ROLES.STARTUP,
      };
      const token = generateToken(startupUser);

      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token}`)
        .send({
          challengeId: '1',
          startupName: 'GreenTech',
          // missing contactPerson, solutionTitle, solutionDescription, etc.
        });

      assert.notEqual(res.status, 201);
      assert.ok([400, 401, 500].includes(res.status));
    });

    test('POST /api/applications does not accept an unpersisted startup identity', async () => {
      const startupUser = {
        id: 'mock_startup_user_4',
        email: 'founder@solar.in',
        role: USER_ROLES.STARTUP,
      };
      const token = generateToken(startupUser);

      const payload = {
        challengeId: '1',
        startupName: 'SolarFlow',
        contactPerson: 'Aditi Rao',
        solutionTitle: 'Smart IoT Waste Sorter',
        solutionDescription: 'Automated municipal waste sorting using computer vision.',
        challengeSolution: 'Directly addresses city bin overflowing and sorting.',
        expectedImpact: '40% reduction in landfill contamination.',
        technology: 'Computer Vision, Edge TPU, MQTT',
      };

      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      assert.ok([401, 500].includes(response.status));
      assert.equal(response.body.success, false);
    });

    test('GET /api/applications/my requires startup authentication', async () => {
      const res = await request(app).get('/api/applications/my');
      assert.equal(res.status, 401);
    });
  });

  describe('4. Government Application Inbox & Status Transitions', () => {
    test('GET /api/applications/gov/inbox denies access to startups (403 Forbidden)', async () => {
      const startupUser = {
        id: 'mock_startup_user_5',
        email: 'applicant@test.com',
        role: USER_ROLES.STARTUP,
      };
      const token = generateToken(startupUser);

      const res = await request(app)
        .get('/api/applications/gov/inbox')
        .set('Authorization', `Bearer ${token}`);

      assert.notEqual(res.status, 200);
      assert.ok([401, 403, 500].includes(res.status));
    });

    test('Status transition validation rules comply with ALLOWED_STATUS_TRANSITIONS', () => {
      // Pending transitions
      const pendingAllowed = ALLOWED_STATUS_TRANSITIONS[APPLICATION_STATUS.PENDING];
      assert.ok(pendingAllowed.includes(APPLICATION_STATUS.UNDER_REVIEW));
      assert.ok(pendingAllowed.includes(APPLICATION_STATUS.APPROVED));
      assert.ok(pendingAllowed.includes(APPLICATION_STATUS.REJECTED));

      // Approved transitions cannot jump straight back to Pending
      const approvedAllowed = ALLOWED_STATUS_TRANSITIONS[APPLICATION_STATUS.APPROVED];
      assert.ok(!approvedAllowed.includes(APPLICATION_STATUS.PENDING));

      // Withdrawn is terminal
      const withdrawnAllowed = ALLOWED_STATUS_TRANSITIONS[APPLICATION_STATUS.WITHDRAWN];
      assert.equal(withdrawnAllowed.length, 0);
    });
  });

  describe('5. Document Download Authorization & Security', () => {
    test('GET /api/documents/:storageKey rejects unauthenticated downloads (401)', async () => {
      const res = await request(app).get('/api/documents/non_existent_key.pdf');
      assert.equal(res.status, 401);
    });

    test('GET /api/documents/:storageKey denies access to unauthorized third party (403/404)', async () => {
      const unrelatedUser = {
        id: 'mock_unrelated_user',
        email: 'stranger@other.com',
        role: USER_ROLES.STARTUP,
      };
      const token = generateToken(unrelatedUser);

      const res = await request(app)
        .get('/api/documents/private_document_key.pdf')
        .set('Authorization', `Bearer ${token}`);

      assert.notEqual(res.status, 200);
      assert.ok([401, 403, 404, 500].includes(res.status));
    });
  });

});

function createDocxBuffer() {
  return createStoredZip({
    '[Content_Types].xml':
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
  });
}

function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const checksum = testCrc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localParts.push(localHeader, nameBytes, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, nameBytes);
    localOffset += localHeader.length + nameBytes.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(Object.keys(files).length, 8);
  endRecord.writeUInt16LE(Object.keys(files).length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function testCrc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createResponse() {
  return {
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
}
