import { redirect } from "next/navigation";
import LoginPageClient from "@/src/components/auth/LoginPageClient";
import { getDefaultRedirectForRole, getSessionUser } from "@/src/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  if (params?.nip || params?.password) {
    redirect("/login");
  }

  const user = await getSessionUser();

  if (user) {
    redirect(getDefaultRedirectForRole(user.role));
  }

  return <LoginPageClient />;
}
