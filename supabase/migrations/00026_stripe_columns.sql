-- Intégration Stripe réelle : identifiants Stripe sur la ligne subscriptions.
-- Renseignés par le webhook service-role au premier checkout.session.completed.
-- Nullable : les lignes créées en mode mock (mock_subscribe) n'en ont pas.
-- Les contraintes `unique` créent déjà l'index btree — pas d'index explicite.
alter table public.subscriptions
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique;
