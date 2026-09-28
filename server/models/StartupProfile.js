import mongoose from 'mongoose';

const VALID_STAGES = ['Idea', 'MVP', 'Early Revenue', 'Growth', ''];

const startupProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    startupName: {
      type: String,
      required: [true, 'Startup name is required'],
      trim: true,
      maxlength: [120, 'Startup name cannot exceed 120 characters'],
      index: true,
    },
    founderName: {
      type: String,
      required: [true, 'Founder name is required'],
      trim: true,
      maxlength: [100, 'Founder name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    website: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^https?:\/\/.+\..+/.test(v);
        },
        message: 'Website must start with http:// or https://',
      },
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    industry: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    stage: {
      type: String,
      enum: {
        values: VALID_STAGES,
        message: '{VALUE} is not a valid stage',
      },
      default: '',
    },
    foundedYear: {
      type: Number,
      min: [1990, 'Founded year must be 1990 or later'],
      max: [new Date().getFullYear() + 1, 'Founded year cannot be in the far future'],
      default: null,
    },
    teamSize: {
      type: Number,
      min: [1, 'Team size must be at least 1'],
      max: [10000, 'Team size cannot exceed 10,000'],
      default: null,
    },
    dpiit: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[A-Z0-9]{6,16}$/i.test(v.trim());
        },
        message: 'DPIIT registration number must be 6 to 16 alphanumeric characters',
      },
    },
    technology: {
      type: String,
      trim: true,
      default: '',
    },
    techTags: {
      type: String,
      trim: true,
      default: '',
    },
    deckLink: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^https?:\/\/.+\..+/.test(v);
        },
        message: 'Deck link must start with http:// or https://',
      },
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

// Virtual for profile completion percentage
startupProfileSchema.virtual('completionPercentage').get(function () {
  const fields = [
    'startupName',
    'founderName',
    'email',
    'phone',
    'website',
    'location',
    'industry',
    'description',
  ];
  const filled = fields.filter((f) => String(this[f] || '').trim() !== '');
  return Math.round((filled.length / fields.length) * 100);
});

// Virtual for profile strength & checklist
startupProfileSchema.virtual('strength').get(function () {
  const fields = [
    'startupName',
    'founderName',
    'email',
    'phone',
    'website',
    'location',
    'industry',
    'description',
    'stage',
    'foundedYear',
    'teamSize',
    'technology',
    'techTags',
  ];
  const filled = fields.filter((f) => {
    const val = this[f];
    return val !== null && val !== undefined && String(val).trim() !== '';
  });
  const percent = Math.round((filled.length / fields.length) * 100);
  const checklist = fields.map((f) => ({
    field: f,
    done: this[f] !== null && this[f] !== undefined && String(this[f]).trim() !== '',
  }));
  return { percent, checklist };
});

const StartupProfile =
  mongoose.models.StartupProfile || mongoose.model('StartupProfile', startupProfileSchema);
export default StartupProfile;
