import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IEventDoc extends Document {
  personId: mongoose.Types.ObjectId;
  type: "birth" | "death" | "marriage" | "divorce" | "immigration" | "other";
  date?: string;
  place?: string;
  description?: string;
  documentUrls: string[];
}

const EventSchema = new Schema<IEventDoc>(
  {
    personId: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    type: {
      type: String,
      enum: ["birth", "death", "marriage", "divorce", "immigration", "other"],
      required: true,
    },
    date: { type: String },
    place: { type: String },
    description: { type: String },
    documentUrls: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default models.Event ?? model<IEventDoc>("Event", EventSchema);
