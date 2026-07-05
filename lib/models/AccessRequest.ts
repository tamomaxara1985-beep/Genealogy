import mongoose, { Schema, Document, models, model } from "mongoose";

export type AccessStatus = "pending" | "approved" | "denied" | "revoked";

export interface IAccessRequestDoc extends Document {
  treeId: mongoose.Types.ObjectId;
  requesterId: mongoose.Types.ObjectId;
  requesterEmail: string;
  status: AccessStatus;
  message: string;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AccessRequestSchema = new Schema<IAccessRequestDoc>(
  {
    treeId: { type: Schema.Types.ObjectId, ref: "Tree", required: true, index: true },
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requesterEmail: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "denied", "revoked"], default: "pending" },
    message: { type: String, default: "" },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

AccessRequestSchema.index({ treeId: 1, requesterId: 1 }, { unique: true });

export default models.AccessRequest ?? model<IAccessRequestDoc>("AccessRequest", AccessRequestSchema);
