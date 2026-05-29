import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    image: { type: String },
  },
  { timestamps: true }
);

export default models.User ?? model<IUserDoc>("User", UserSchema);
