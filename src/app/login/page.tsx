import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Member Login",
  description: "Sign in to your Des Moines Fencing Club member account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/member");
  }

  const { next, error } = await searchParams;

  return <LoginForm next={next} error={error} />;
}
