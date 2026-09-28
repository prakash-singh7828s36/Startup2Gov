import mongoose from 'mongoose';

export const APPLICATION_STATUS = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const ACTIVE_APPLICATION_STATUSES = Object.values(APPLICATION_STATUS).filter(
  (status) => status !== APPLICATION_STATUS.WITHDRAWN
);

export const ALLOWED_STATUS_TRANSITIONS = {
  [APPLICATION_STATUS.PENDING]: [
    APPLICATION_STATUS.UNDER_REVIEW,
    APPLICATION_STATUS.APPROVED,
    APPLICATION_STATUS.REJECTED,
    APPLICATION_STATUS.WITHDRAWN,
  ],
  [APPLICATION_STATUS.UNDER_REVIEW]: [
    APPLICATION_STATUS.APPROVED,
    APPLICATION_STATUS.REJECTED,
    APPLICATION_STATUS.PENDING,
    APPLICATION_STATUS.WITHDRAWN,
  ],
  [APPLICATION_STATUS.APPROVED]: [
    APPLICATION_STATUS.UNDER_REVIEW,
    APPLICATION_STATUS.REJECTED,
  ],
  [APPLICATION_STATUS.REJECTED]: [
    APPLICATION_STATUS.UNDER_REVIEW,
    APPLICATION_STATUS.PENDING,
  ],
  [APPLICATION_STATUS.WITHDRAWN]: [],
};

const documentSchema = new mongoose.Schema(
  {
    originalName: { type: String, trim: true },
    storageKey: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number, default: 0 },
    url: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: Object.values(APPLICATION_STATUS),
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    changedByName: {
      type: String,
      default: '',
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    applicationNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Startup applicant is required'],
      index: true,
    },
    challenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
      default: null,
      index: true,
    },
    challengeId: {
      type: String,
      required: [true, 'Challenge reference ID is required'],
      index: true,
    },
    challengeTitle: {
      type: String,
      required: [true, 'Challenge title is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
    },
    startupName: {
      type: String,
      required: [true, 'Startup name is required'],
      trim: true,
    },
    contactPerson: {
      type: String,
      required: [true, 'Contact person name is required'],
      trim: true,
    },
    solutionTitle: {
      type: String,
      required: [true, 'Solution title is required'],
      trim: true,
    },
    solutionDescription: {
      type: String,
      required: [true, 'Solution description is required'],
      trim: true,
    },
    challengeSolution: {
      type: String,
      required: [true, 'Challenge solution explanation is required'],
      trim: true,
    },
    expectedImpact: {
      type: String,
      required: [true, 'Expected impact is required'],
      trim: true,
    },
    technology: {
      type: String,
      required: [true, 'Technology stack is required'],
      trim: true,
    },
    document: {
      type: documentSchema,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(APPLICATION_STATUS),
        message: '{VALUE} is not a valid application status',
      },
      default: APPLICATION_STATUS.PENDING,
      index: true,
    },
    submittedOn: {
      type: String,
      default: '',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewNote: {
      type: String,
      default: '',
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedByName: {
      type: String,
      default: '',
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  {
    autoIndex: false,
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        // Keep compatibility with frontend UI expectations
        ret.solution = ret.solutionTitle;
        ret.challenge = ret.challengeTitle;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (_doc, ret) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        ret.solution = ret.solutionTitle;
        ret.challenge = ret.challengeTitle;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes
applicationSchema.index(
  { user: 1, challengeId: 1 },
  {
    unique: true,
    name: 'user_1_challengeId_1',
    partialFilterExpression: {
      $or: [
        { status: { $exists: false } },
        { status: null },
        ...ACTIVE_APPLICATION_STATUSES.map((status) => ({ status })),
      ],
    },
  }
);
applicationSchema.index({ challengeId: 1, status: 1 });
applicationSchema.index({ user: 1, status: 1 });

const Application =
  mongoose.models.Application || mongoose.model('Application', applicationSchema);
export default Application;
