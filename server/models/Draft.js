import mongoose from 'mongoose';

const draftSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    challengeId: {
      type: String,
      required: true,
      index: true,
    },
    formData: {
      startupName: { type: String, default: '' },
      contactPerson: { type: String, default: '' },
      solutionTitle: { type: String, default: '' },
      solutionDescription: { type: String, default: '' },
      challengeSolution: { type: String, default: '' },
      expectedImpact: { type: String, default: '' },
      technology: { type: String, default: '' },
    },
    documentMetadata: {
      name: { type: String, default: '' },
      storageKey: { type: String, default: '' },
      size: { type: Number, default: 0 },
      mimeType: { type: String, default: '' },
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
  }
);

draftSchema.index({ user: 1, challengeId: 1 }, { unique: true });

const Draft = mongoose.models.Draft || mongoose.model('Draft', draftSchema);
export default Draft;
