import { AuthForm } from "@/features/auth/ui/AuthForm";
import { signIn } from "@/features/auth/data/actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 shadow-sm">
        <AuthForm action={signIn} submitLabelKey="login" />
      </div>
    </main>
  );
}
