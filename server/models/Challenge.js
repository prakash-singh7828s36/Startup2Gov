import mongoose from 'mongoose';
import { slugify } from '../utils/slug.js';

export const CHALLENGE_STATUS = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  CLOSED: 'Closed',
};

const eligibilitySchema = new mongoose.Schema(
  {
    stages: {
      type: [String],
      default: ['Idea', 'MVP', 'Early Revenue', 'Growth'],
    },
    needsDPIIT: {
      type: Boolean,
      default: false,
    },
    minTeam: {
      type: Number,
      default: 1,
      min: 1,
    },
    note: {
      type: String,
      default: 'Open to DPIIT-recognised and early-stage startups.',
      trim: true,
    },
  },
  { _id: false }
);

const challengeSchema = new mongoose.Schema(
  {
    customId: {
      type: Number,
      index: true,
      sparse: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Challenge title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
      index: true,
    },
    department: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      maxlength: [150, 'Department name cannot exceed 150 characters'],
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category / industry is required'],
      trim: true,
      index: true,
    },
    problemStatement: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
    },
    location: {
      type: String,
      trim: true,
      default: 'Pan-India',
    },
    budget: {
      type: String,
      trim: true,
      default: 'Pilot grant (TBD)',
    },
    duration: {
      type: String,
      trim: true,
      default: '6-month pilot',
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    requirements: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    matchKeywords: {
      type: [String],
      default: [],
    },
    eligibility: {
      type: eligibilitySchema,
      default: () => ({}),
    },
    deadline: {
      type: String,
      trim: true,
      default: '',
    },
    deadlineDate: {
      type: Date,
      required: [true, 'Application deadline date is required'],
      index: true,
    },
    postedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(CHALLENGE_STATUS),
        message: '{VALUE} is not a valid challenge status',
      },
      default: CHALLENGE_STATUS.OPEN,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    createdByName: {
      type: String,
      trim: true,
      default: '',
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        // Keep deadline string synced if present
        if (!ret.deadline && ret.deadlineDate) {
          ret.deadline = new Date(ret.deadlineDate).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (_doc, ret) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
challengeSchema.index({ status: 1, category: 1, deadlineDate: 1 });
challengeSchema.index({ createdBy: 1, status: 1 });
challengeSchema.index({ title: 'text', description: 'text', department: 'text', tags: 'text' });

// Pre-save hook: auto-generate slug if missing
challengeSchema.pre('save', function (next) {
  if (!this.slug && this.title) {
    const baseSlug = slugify(this.title);
    const suffix = this.customId ? `-${this.customId}` : `-${Date.now().toString(36)}`;
    this.slug = `${baseSlug}${suffix}`;
  }
  if (!this.problemStatement && this.description) {
    this.problemStatement = this.description;
  }
  next();
});

const Challenge = mongoose.models.Challenge || mongoose.model('Challenge', challengeSchema);
export default Challenge;
