import { AuthForm } from "@/features/auth/ui/AuthForm";
import { signUp } from "@/features/auth/data/actions";

export default function SignupPage() {
  return <main className="p-6"><AuthForm action={signUp} submitLabelKey="signup" /></main>;
}
