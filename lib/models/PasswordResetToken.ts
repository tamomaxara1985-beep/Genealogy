import { Schema, Document, models, model, Types } from "mongoose";

export interface IPasswordResetTokenDoc extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetTokenDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // SHA-256 hash of the raw token — raw token only ever lives in the email link.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index: Mongo auto-deletes the doc once expiresAt passes.
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default models.PasswordResetToken ??
  model<IPasswordResetTokenDoc>("PasswordResetToken", PasswordResetTokenSchema);
