import { auth } from "@/lib/auth"

export async function getAdminSession() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "admin") return null
  return session
}
