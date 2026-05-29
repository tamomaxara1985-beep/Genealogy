import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ITreeDoc extends Document {
  name: string;
  description?: string;
  ownerId: mongoose.Types.ObjectId;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TreeSchema = new Schema<ITreeDoc>(
  {
    name: { type: String, required: true },
    description: { type: String },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default models.Tree ?? model<ITreeDoc>("Tree", TreeSchema);
