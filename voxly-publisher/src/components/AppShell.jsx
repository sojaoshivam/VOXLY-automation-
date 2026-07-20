import { auth, signOut } from "@/auth";
import SidebarLayout from "@/components/SidebarLayout";

export default async function AppShell({ children }) {
  const session = await auth();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <SidebarLayout user={session?.user} signOutAction={signOutAction}>
      {children}
    </SidebarLayout>
  );
}
