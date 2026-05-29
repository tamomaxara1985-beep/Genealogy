import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IPersonDoc extends Document {
  treeId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  maidenName?: string;
  gender: "male" | "female" | "other" | "unknown";
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  isLiving: boolean;
  photoUrl?: string;
  notes?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PersonSchema = new Schema<IPersonDoc>(
  {
    treeId: { type: Schema.Types.ObjectId, ref: "Tree", required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    maidenName: { type: String },
    gender: {
      type: String,
      enum: ["male", "female", "other", "unknown"],
      default: "unknown",
    },
    birthDate: { type: String },
    birthPlace: { type: String },
    deathDate: { type: String },
    deathPlace: { type: String },
    isLiving: { type: Boolean, default: true },
    photoUrl: { type: String },
    notes: { type: String },
    bio: { type: String },
  },
  { timestamps: true }
);

export default models.Person ?? model<IPersonDoc>("Person", PersonSchema);
