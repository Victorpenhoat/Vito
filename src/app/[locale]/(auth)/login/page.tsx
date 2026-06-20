import { AuthForm } from "@/features/auth/ui/AuthForm";
import { signIn } from "@/features/auth/data/actions";

export default function LoginPage() {
  return <main className="p-6"><AuthForm action={signIn} submitLabelKey="login" /></main>;
}
