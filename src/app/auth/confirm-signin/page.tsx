import type { Metadata } from "next";
import { ConfirmSignIn } from "@/components/ConfirmSignIn";

export const metadata: Metadata = {
  title: "Confirm Sign In",
  description: "Confirm your sign-in to the Des Moines Fencing Club member area.",
};

export default async function ConfirmSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  return <ConfirmSignIn tokenHash={token_hash} type={type} />;
}
