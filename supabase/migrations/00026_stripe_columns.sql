-- Intégration Stripe réelle : identifiants Stripe sur la ligne subscriptions.
-- Renseignés par le webhook service-role au premier checkout.session.completed.
-- Nullable : les lignes créées en mode mock (mock_subscribe) n'en ont pas.
alter table public.subscriptions
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique;

create index subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id);
