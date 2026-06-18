import { Schema, Document, models, model } from "mongoose"

export interface ISiteSettingsDoc extends Document {
  primaryColor: string
  fontFamily: string
  fontSize: "sm" | "md" | "lg" | "xl"
  borderRadius: number
  updatedAt: Date
}

const SiteSettingsSchema = new Schema<ISiteSettingsDoc>(
  {
    primaryColor: { type: String, default: "oklch(0.205 0 0)" },
    fontFamily: { type: String, default: "Inter" },
    fontSize: { type: String, enum: ["sm", "md", "lg", "xl"], default: "md" },
    borderRadius: { type: Number, default: 0.625 },
  },
  { timestamps: true }
)

export default models.SiteSettings ?? model<ISiteSettingsDoc>("SiteSettings", SiteSettingsSchema)
