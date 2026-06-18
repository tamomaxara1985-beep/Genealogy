import { Schema, Document, models, model } from "mongoose"

export interface ISiteContentDoc extends Document {
  locale: string
  key: string
  value: string
  updatedAt: Date
}

const SiteContentSchema = new Schema<ISiteContentDoc>(
  {
    locale: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: String, required: true },
  },
  { timestamps: true }
)

SiteContentSchema.index({ locale: 1, key: 1 }, { unique: true })

export default models.SiteContent ?? model<ISiteContentDoc>("SiteContent", SiteContentSchema)
