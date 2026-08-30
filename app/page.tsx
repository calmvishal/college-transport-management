import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";

const ROLE_HOME: Record<string, string> = {
  student: "/student",
  driver: "/driver",
  incharge: "/incharge/dashboard",
};

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  redirect(ROLE_HOME[session.user.role] || "/login");
}
