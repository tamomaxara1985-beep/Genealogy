import { Schema, Document, models, model } from "mongoose";

export interface IResearcherInfoDoc extends Document {
  name: string;
  surname: string;
  email: string;
  phone: string;
  region: string;
  updatedAt: Date;
}

const ResearcherInfoSchema = new Schema<IResearcherInfoDoc>(
  {
    name: { type: String, default: "" },
    surname: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    region: { type: String, default: "" },
  },
  { timestamps: true }
);

export default models.ResearcherInfo ?? model<IResearcherInfoDoc>("ResearcherInfo", ResearcherInfoSchema);
