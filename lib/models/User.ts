import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  role: "user" | "admin";
  bio?: string;
  researcher?: {
    fullName: string;
    contact: string;
    notes?: string;
    assignmentDate?: string;
    status: "Assigned" | "In Progress" | "Completed";
  };
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
    bio: { type: String },
    researcher: {
      type: new Schema(
        {
          fullName: { type: String, required: true },
          contact: { type: String, required: true },
          notes: { type: String },
          assignmentDate: { type: String },
          status: {
            type: String,
            enum: ["Assigned", "In Progress", "Completed"],
            default: "Assigned",
          },
        },
        { _id: false }
      ),
      required: false,
    },
  },
  { timestamps: true }
);

export default models.User ?? model<IUserDoc>("User", UserSchema);
