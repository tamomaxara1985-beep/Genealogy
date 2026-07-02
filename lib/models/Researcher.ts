import { Schema, Document, models, model } from "mongoose";

interface LocalizedName {
  en: string;
  ka: string;
  he: string;
}

export interface IResearcherDoc extends Document {
  name: LocalizedName;
  surname: LocalizedName;
  email: string;
  phone: string;
  region: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocalizedNameSchema = new Schema<LocalizedName>(
  {
    en: { type: String, default: "" },
    ka: { type: String, default: "" },
    he: { type: String, default: "" },
  },
  { _id: false }
);

const ResearcherSchema = new Schema<IResearcherDoc>(
  {
    name: { type: LocalizedNameSchema, default: () => ({}) },
    surname: { type: LocalizedNameSchema, default: () => ({}) },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    region: { type: String, default: "" },
  },
  { timestamps: true }
);

export default models.Researcher ?? model<IResearcherDoc>("Researcher", ResearcherSchema);
