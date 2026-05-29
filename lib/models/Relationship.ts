import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IRelationshipDoc extends Document {
  treeId: mongoose.Types.ObjectId;
  type: "parent-child" | "spouse";
  person1Id: mongoose.Types.ObjectId;
  person2Id: mongoose.Types.ObjectId;
  startDate?: string;
  endDate?: string;
}

const RelationshipSchema = new Schema<IRelationshipDoc>(
  {
    treeId: { type: Schema.Types.ObjectId, ref: "Tree", required: true },
    type: { type: String, enum: ["parent-child", "spouse"], required: true },
    person1Id: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    person2Id: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    startDate: { type: String },
    endDate: { type: String },
  },
  { timestamps: true }
);

export default models.Relationship ??
  model<IRelationshipDoc>("Relationship", RelationshipSchema);
