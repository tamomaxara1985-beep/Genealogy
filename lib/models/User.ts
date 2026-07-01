import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  role: "user" | "admin";
  bio?: string;
  researcher?: {
    name: string;
    surname: string;
    email: string;
    phone: string;
    region: string;
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
          name: { type: String, required: true },
          surname: { type: String, required: true },
          email: { type: String, required: true },
          phone: { type: String, required: true },
          region: { type: String, required: true },
        },
        { _id: false }
      ),
      required: false,
    },
  },
  { timestamps: true }
);

export default models.User ?? model<IUserDoc>("User", UserSchema);
