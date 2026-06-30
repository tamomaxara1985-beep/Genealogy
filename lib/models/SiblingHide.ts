import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ISiblingHideDoc extends Document {
  treeId: mongoose.Types.ObjectId;
  personAId: mongoose.Types.ObjectId;
  personBId: mongoose.Types.ObjectId;
}

const SiblingHideSchema = new Schema<ISiblingHideDoc>(
  {
    treeId: { type: Schema.Types.ObjectId, ref: "Tree", required: true },
    personAId: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    personBId: { type: Schema.Types.ObjectId, ref: "Person", required: true },
  },
  { timestamps: true }
);

SiblingHideSchema.index(
  { treeId: 1, personAId: 1, personBId: 1 },
  { unique: true }
);

export default models.SiblingHide ??
  model<ISiblingHideDoc>("SiblingHide", SiblingHideSchema);
