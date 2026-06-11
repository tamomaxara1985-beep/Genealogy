import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  role: "user" | "admin";
  plan: "free" | "standard" | "premium";
  planStatus: "active" | "cancelled" | "on_hold" | "expired";
  dodoCustomerId?: string | null;
  dodoSubscriptionId?: string | null;
  planExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    image: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    plan: {
      type: String,
      enum: ["free", "standard", "premium"],
      default: "free",
    },
    planStatus: {
      type: String,
      enum: ["active", "cancelled", "on_hold", "expired"],
      default: "active",
    },
    dodoCustomerId: { type: String, default: null },
    dodoSubscriptionId: { type: String, default: null },
    planExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default models.User ?? model<IUserDoc>("User", UserSchema);
