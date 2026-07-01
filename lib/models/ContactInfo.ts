import { Schema, Document, models, model } from "mongoose";

export interface IContactInfoDoc extends Document {
  orgName: string;
  address: string;
  mapQuery: string;
  phone: string;
  email: string;
  hours: { days: string; hours: string }[];
  socials: { platform: string; url: string }[];
  updatedAt: Date;
}

const HourSchema = new Schema(
  { days: { type: String, default: "" }, hours: { type: String, default: "" } },
  { _id: false }
);
const SocialSchema = new Schema(
  { platform: { type: String, default: "" }, url: { type: String, default: "" } },
  { _id: false }
);

const ContactInfoSchema = new Schema<IContactInfoDoc>(
  {
    orgName: { type: String, default: "" },
    address: { type: String, default: "" },
    mapQuery: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    hours: { type: [HourSchema], default: [] },
    socials: { type: [SocialSchema], default: [] },
  },
  { timestamps: true }
);

export default models.ContactInfo ?? model<IContactInfoDoc>("ContactInfo", ContactInfoSchema);
