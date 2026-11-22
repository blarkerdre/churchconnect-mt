ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_known_service
  CHECK (endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)/');