import type { Role } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: Role;
      route: string;
      vehicleId: string;
      studentId: string;
    };
  }

  interface User {
    id: string;
    role: Role;
    route: string;
    vehicleId: string;
    studentId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    route: string;
    vehicleId: string;
    studentId: string;
    userId: string;
  }
}
