import "@testing-library/jest-dom/vitest";

// Variables d'env factices pour que src/lib/env (validé par zod au chargement) passe
// dans les tests d'unités qui importent transitivement la chaîne services/*.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
