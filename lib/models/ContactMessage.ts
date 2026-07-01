import { Schema, Document, models, model } from "mongoose";

export interface IContactMessageDoc extends Document {
  fullName: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "read";
  createdAt: Date;
  updatedAt: Date;
}

const ContactMessageSchema = new Schema<IContactMessageDoc>(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["new", "read"], default: "new" },
  },
  { timestamps: true }
);

export default models.ContactMessage ?? model<IContactMessageDoc>("ContactMessage", ContactMessageSchema);
